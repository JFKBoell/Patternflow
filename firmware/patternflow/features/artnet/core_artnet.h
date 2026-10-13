// ═══════════════════════════════════════════════════════════
// PatternFlow - Art-Net in: frames from Resolume, TouchDesigner, MadMapper
//
// Pixels arrive as ArtDmx on UDP 6454, one universe of up to 170 RGB pixels
// per packet - 49 universes for the 128×64 panel - and are shown on the
// frame's way to the panel (the composeFrame hook), in place of the running
// pattern or over it.
//
// Three parties, three buffers, no locks anyone waits on:
//
//   the receive task (Core 0)   writes universes into BACK; a finished frame
//                               is published by swapping BACK into READY
//   composeFrame (loop, Core 1) takes READY as FRONT when a newer one is
//                               there, and hands FRONT to the blit
//   READY                       one atomic byte: buffer index | FRESH
//
// The receive task never sees FRONT and compose never sees BACK, so a frame
// on the panel is never one being written (no tearing), and neither side
// ever waits for the other. A frame published before the panel took the
// previous one replaces it; that is counted (`skipped`) rather than queued.
//
// What ends a frame (Art-Net 4, "Managing Synchronous and non-Synchronous
// modes"):
//   - ArtSync, from the same IP as the latest ArtDmx: the frame is shown at
//     once, complete or not, and the node is in synchronous mode - ArtDmx is
//     held until the next ArtSync. Four seconds without one and it falls back.
//   - without ArtSync: every expected universe has arrived; or a universe
//     arrives that the open frame already holds (the next frame has begun);
//     or no packet has arrived for `gap` ms (silence after the open frame's
//     latest packet).
// An incomplete frame keeps the previous frame's pixels where universes are
// missing, rather than older ones, and is counted (`incomplete`).
//
// Several senders on one universe are not merged: packets are written as
// they arrive, so the latest wins per universe. The specification allows
// either merging or treating it as an error, and asks that the choice be
// documented - this is it, and the README says so.
//
// Discovery: an ArtPoll is answered with one ArtPollReply per universe
// (BindIndex 1..N, one output port each, which is how Art-Net 4 describes a
// node with more than four ports), unicast to the poller after a random
// delay of up to half a second.
//
// License: MIT
// ═══════════════════════════════════════════════════════════
#pragma once
#include "artnet_config.h"

#include <Arduino.h>
#include <Preferences.h>
#include <WiFi.h>
#include <atomic>
#include <string.h>

#include "lwip/sockets.h"
#include "lwip/pbuf.h"
#include "lwip/tcpip.h"
#include "lwip/udp.h"
#include "esp_random.h"
#include "esp_freertos_hooks.h"

#include "../../src/core_mem.h"
#include "../../presets/preset_calib.h"  // the test card owns the panel while it is up
#include "../pf_feature.h"

namespace PatternflowArtnet {

constexpr int W = PANEL_RES_W;
constexpr int H = PANEL_RES_H;
constexpr int PIXELS = W * H;
constexpr size_t FRAME_BYTES = (size_t)PIXELS * 3;
constexpr const char* NVS_NS = "artnet";

constexpr uint16_t OP_POLL = 0x2000;
constexpr uint16_t OP_POLL_REPLY = 0x2100;
constexpr uint16_t OP_DMX = 0x5000;
constexpr uint16_t OP_SYNC = 0x5200;
constexpr size_t POLL_REPLY_BYTES = 239;   // through the 10-byte Filler

// The smallest universe allowed is 16 pixels, which caps the universe count
// at 512 and keeps the "seen" bitmap at 64 bytes.
constexpr int PPU_MIN = 16;
constexpr int PPU_MAX = 170;
constexpr int MAX_UNIVERSES = (PIXELS + PPU_MIN - 1) / PPU_MIN;

enum Mode : uint8_t { ModeReplace = 0, ModeOverlay = 1 };

// Channel orders, by the position each colour has in the packet.
constexpr const char* ORDER_NAMES[6] = {"RGB", "RBG", "GRB", "GBR", "BRG", "BGR"};

// ── Settings ────────────────────────────────────────────────────────────
// Written on the loop task (HTTP handlers go through PFLoopSync, the NETWORK
// screen is already there); compose reads them on the same task. The receive
// task takes its own copy under cfgMux whenever cfgEpoch moves.
struct Config {
  uint16_t universe = PF_ARTNET_DEFAULT_UNIVERSE;  // Port-Address of pixel 0
  uint8_t ppu = PF_ARTNET_DEFAULT_PPU;             // pixels per universe
  uint8_t order = 0;                               // index into ORDER_NAMES
  bool serpentine = false;                         // odd rows run right-to-left
  uint8_t rot = 0;                                 // quarter turns, 1 = upright
  bool flipX = false;
  bool flipY = false;
  uint8_t mode = ModeReplace;
  uint8_t threshold = PF_ARTNET_DEFAULT_THRESHOLD; // overlay: at or below lets the pattern through
  uint16_t timeoutMs = PF_ARTNET_DEFAULT_TIMEOUT_MS;
  uint8_t gapMs = PF_ARTNET_DEFAULT_GAP_MS;
};

inline Config cfg;
inline portMUX_TYPE cfgMux = portMUX_INITIALIZER_UNLOCKED;
inline std::atomic<uint32_t> cfgEpoch{1};
inline std::atomic<bool> enabled{true};

// Which receive path to open at the next boot (NVS "raw"), and which one is
// open now. Both bind 6454, so only one can exist per boot.
//   socket  a BSD socket read by the pf-artnet task (the default)
//   raw     lwIP's udp_recv callback: each datagram is handled inside the
//           tcpip thread as it arrives - no netbuf, no socket mailbox (six
//           datagrams in this SDK), no task switch per packet
enum RxPath : uint8_t { RxNone = 0, RxSocket = 1, RxRaw = 2 };
inline bool rawWanted = false;
inline std::atomic<uint8_t> rxPath{RxNone};

inline int universesFor(int ppu) { return (PIXELS + ppu - 1) / ppu; }

// ── Counters (written by the receive task, read by anyone) ──────────────
inline std::atomic<uint32_t> packets{0};      // ArtDmx for our universes
inline std::atomic<uint32_t> ignored{0};      // Art-Net for other universes/opcodes
inline std::atomic<uint32_t> frames{0};       // frames published
inline std::atomic<uint32_t> incomplete{0};   // ... of which were missing universes
inline std::atomic<uint32_t> skipped{0};      // published, replaced before the panel took them
inline std::atomic<uint32_t> shown{0};        // frames the panel actually took
inline std::atomic<uint32_t> polls{0};        // ArtPolls answered
inline std::atomic<uint32_t> lastSender{0};   // IPv4, network order
inline std::atomic<uint32_t> lastFrameMs{0};  // millis() of the last publish, 0 = never
inline std::atomic<bool> syncMode{false};
inline std::atomic<uint32_t> rxFpsX10{0};     // published frames per second ×10
inline std::atomic<uint32_t> ppsNow{0};       // packets per second
inline std::atomic<uint32_t> shownFpsX10{0};  // frames taken by the panel per second ×10
inline std::atomic<uint32_t> stackMin{0};
inline std::atomic<bool> resetRequested{false};

// Diagnostics: where a burst goes missing. Reset with the counters.
inline std::atomic<uint32_t> queueMax{0};     // socket: most datagrams found still waiting after a read
inline std::atomic<uint32_t> procUsMax{0};    // handling one datagram, µs
inline std::atomic<uint32_t> procUsAvg{0};    // ... averaged over the latest second that had traffic
inline std::atomic<uint32_t> burstUsMax{0};   // first to last packet of a published frame, µs
inline std::atomic<uint32_t> burstUsAvg{0};   // ... averaged like procUsAvg
inline std::atomic<uint32_t> lossy{0};        // unsynced frames published incomplete
inline std::atomic<uint32_t> lossyIdle{0};    // ... during whose burst Core 0 went idle
inline std::atomic<uint32_t> tcpipStackMin{0};// raw path: lwIP tcpip thread's stack high-water mark
inline std::atomic<bool> wifiStatic{false};   // this boot started Wi-Fi with static buffers
inline uint32_t* missCount = nullptr;         // per universe: frames published without it (PSRAM)

inline void noteMax(std::atomic<uint32_t>& slot, uint32_t v) {
  uint32_t cur = slot.load(std::memory_order_relaxed);
  while (v > cur && !slot.compare_exchange_weak(cur, v, std::memory_order_relaxed)) {
  }
}

// Core 0's idle task stamps this every time it gets to run. If it ran
// between two packets of a burst that still lost packets, nothing on the
// ESP side - Wi-Fi task, tcpip, this receiver - had work queued at that
// moment, so the packets were lost before they reached the ESP's software
// queues: at the sender, or on the air.
inline volatile uint32_t idleUs = 0;
inline bool idleHook() {
  idleUs = micros();
  return true;   // once per wake-up is enough; do not spin the idle task
}

// Opt-in (NVS "wifibuf", applies at boot): start Wi-Fi with the SDK's static
// buffers instead of Arduino's defaults. Arduino 2.0.17's WiFiGeneric.cpp
// gives the radio 4 static RX (DMA) buffers unless useStaticBuffers(true)
// was called before Wi-Fi starts, while A-MPDU receive allows 16 subframes
// per aggregate (the SDK's own guidance: static RX >= that window). With it
// the sdkconfig values apply: 8 static RX and 8 static TX buffers, about
// 1.6 KB of INTERNAL RAM each - roughly 19 KB more than the default. An
// experiment, off by default, and it changes the radio for the whole device.
inline bool wifiStaticWanted = false;

// ── Buffers: taken in setup(), before anything is parked in PSRAM ───────
inline uint8_t* bufs[3] = {nullptr, nullptr, nullptr};
inline uint8_t* overlayOut = nullptr;   // overlay mode's result
inline uint16_t* lut = nullptr;         // pixel index in the stream → panel pixel
constexpr uint8_t FRESH = 0x80;
inline std::atomic<uint8_t> readySlot{1};
inline uint8_t frontIdx = 2;            // compose's own (loop task)

inline bool allocated() { return bufs[0] && bufs[1] && bufs[2] && overlayOut && lut && missCount; }

// ── Persistence ─────────────────────────────────────────────────────────
inline void loadConfig() {
  Config c;
  bool on = true;
  Preferences p;
  if (p.begin(NVS_NS, true)) {
    on = p.getBool("on", true);
    c.universe = p.getUShort("uni", c.universe) & 0x7FFF;
    c.ppu = p.getUChar("ppu", c.ppu);
    c.order = p.getUChar("order", c.order);
    c.serpentine = p.getBool("serp", c.serpentine);
    c.rot = p.getUChar("rot", c.rot);
    c.flipX = p.getBool("fx", c.flipX);
    c.flipY = p.getBool("fy", c.flipY);
    c.mode = p.getUChar("mode", c.mode);
    c.threshold = p.getUChar("thr", c.threshold);
    c.timeoutMs = p.getUShort("tmo", c.timeoutMs);
    c.gapMs = p.getUChar("gap", c.gapMs);
    rawWanted = p.getBool("raw", false);
    wifiStaticWanted = p.getBool("wifibuf", false);
    p.end();
  }
  if (c.ppu < PPU_MIN || c.ppu > PPU_MAX) c.ppu = PF_ARTNET_DEFAULT_PPU;
  if (c.order > 5) c.order = 0;
  c.rot &= 3;
  if (c.mode > ModeOverlay) c.mode = ModeReplace;
  if (c.timeoutMs < 100) c.timeoutMs = 100;
  if (c.gapMs < 2) c.gapMs = 2;
  portENTER_CRITICAL(&cfgMux);
  cfg = c;
  portEXIT_CRITICAL(&cfgMux);
  enabled.store(on);
  cfgEpoch.fetch_add(1);
}

inline void saveConfig() {
  Preferences p;
  if (!p.begin(NVS_NS, false)) return;
  p.putBool("on", enabled.load());
  p.putUShort("uni", cfg.universe);
  p.putUChar("ppu", cfg.ppu);
  p.putUChar("order", cfg.order);
  p.putBool("serp", cfg.serpentine);
  p.putUChar("rot", cfg.rot);
  p.putBool("fx", cfg.flipX);
  p.putBool("fy", cfg.flipY);
  p.putUChar("mode", cfg.mode);
  p.putUChar("thr", cfg.threshold);
  p.putUShort("tmo", cfg.timeoutMs);
  p.putUChar("gap", cfg.gapMs);
  p.putBool("raw", rawWanted);
  p.putBool("wifibuf", wifiStaticWanted);
  p.end();
}

// Apply a changed Config (loop task). The receive task picks it up at its
// next packet or timeout.
inline void setConfig(const Config& c) {
  portENTER_CRITICAL(&cfgMux);
  cfg = c;
  portEXIT_CRITICAL(&cfgMux);
  cfgEpoch.fetch_add(1);
}

inline void setEnabled(bool on) {
  enabled.store(on);
  cfgEpoch.fetch_add(1);
}

// ── Mapping ─────────────────────────────────────────────────────────────
// Stream pixel p sits at (sx, sy) in the sender's raster - W×H, or H×W when
// the panel is turned a quarter - row by row, odd rows reversed when
// serpentine. Mirrors apply in the sender's raster; the quarter turns then
// take it onto the panel the way PFCanvas::setFrame turns a portrait
// pattern (rot 1 = the panel stood on its end, as its menus read).
inline void buildLut(const Config& c) {
  const bool portrait = c.rot & 1;
  const int sw = portrait ? H : W;
  const int sh = portrait ? W : H;
  for (int p = 0; p < PIXELS; p++) {
    int sy = p / sw;
    int sx = p % sw;
    if (c.serpentine && (sy & 1)) sx = sw - 1 - sx;
    if (c.flipX) sx = sw - 1 - sx;
    if (c.flipY) sy = sh - 1 - sy;
    int px, py;
    switch (c.rot) {
      case 1: px = W - 1 - sy; py = sx; break;
      case 2: px = W - 1 - sx; py = H - 1 - sy; break;
      case 3: px = sy; py = H - 1 - sx; break;
      default: px = sx; py = sy; break;
    }
    lut[p] = (uint16_t)(py * W + px);
  }
}

// ── The receive task ────────────────────────────────────────────────────
// Everything below until compose() is the task's own state; nothing else
// touches it.
namespace ArtnetRx {
inline Config c;                 // the task's copy of cfg
inline uint32_t epochSeen = 0;
inline int universes = 0;        // expected per frame
inline uint8_t perm[3] = {0, 1, 2};  // packet offset of R, G, B
inline uint8_t back = 0;
inline int lastPublished = -1;
inline uint8_t seen[(MAX_UNIVERSES + 7) / 8];
inline int seenCount = 0;
inline bool frameOpen = false;
inline uint32_t lastPacketMs = 0;  // the open frame's latest ArtDmx
inline uint32_t frameFirstUs = 0, lastPacketUs = 0;
inline bool frameIdle = false;     // Core 0 went idle inside the open frame's burst
// Window sums for the averages: wrap-safe because only differences over one
// second are used.
inline uint32_t procSum = 0, procN = 0, burstSum = 0, burstN = 0;
inline uint32_t procSum0 = 0, procN0 = 0, burstSum0 = 0, burstN0 = 0;
inline uint32_t pollQueued = 0;    // a second poller, answered after the current one
inline int pollNextK = 0;          // next universe to reply for
inline uint32_t stackAtMs = 0;
inline bool identity = true;       // the mapping is the panel's own raster
inline bool rgbOrder = true;
inline uint32_t lastSyncMs = 0;
inline uint32_t lastDmxIp = 0;
inline uint32_t pollTarget = 0;  // 0 = no reply pending
inline uint32_t pollDueMs = 0;
inline uint32_t pollReplies = 0; // NodeReport's counter
inline int sock = -1;
inline udp_pcb* pcb = nullptr;
inline uint8_t pkt[640];         // one datagram; ArtDmx is at most 530
inline uint8_t reply[POLL_REPLY_BYTES];
inline TaskHandle_t task = nullptr;
inline uint32_t rateAtMs = 0, ratePackets = 0, rateFrames = 0;

inline bool seenTest(int k) { return seen[k >> 3] & (1 << (k & 7)); }
inline void seenSet(int k) { seen[k >> 3] |= (uint8_t)(1 << (k & 7)); }

inline void syncConfig() {
  uint32_t e = cfgEpoch.load();
  if (e == epochSeen) return;
  Config n;
  portENTER_CRITICAL(&cfgMux);
  n = cfg;
  portEXIT_CRITICAL(&cfgMux);
  epochSeen = e;
  const bool remap = n.rot != c.rot || n.serpentine != c.serpentine ||
                     n.flipX != c.flipX || n.flipY != c.flipY || universes == 0;
  // Index k means another universe now; old counts would be mislabelled.
  if (n.ppu != c.ppu || n.universe != c.universe || universes == 0) {
    memset(missCount, 0, MAX_UNIVERSES * sizeof(uint32_t));
  }
  c = n;
  universes = universesFor(c.ppu);
  const char* o = ORDER_NAMES[c.order];
  for (int i = 0; i < 3; i++) perm[i] = (uint8_t)(strchr(o, "RGB"[i]) - o);
  if (remap) buildLut(c);
  identity = c.rot == 0 && !c.serpentine && !c.flipX && !c.flipY;
  rgbOrder = c.order == 0;
  // A frame half-written under the old layout is not finished under the new.
  frameOpen = false;
}

inline void openFrame(uint32_t now) {
  memset(seen, 0, sizeof(seen));
  seenCount = 0;
  frameOpen = true;
  lastPacketMs = now;
  frameFirstUs = lastPacketUs = micros();
  frameIdle = false;
}

// Stream pixels [first, end) of BACK take the last published frame's values.
inline void keepPrevious(int first, int end) {
  if (lastPublished < 0) return;
  const uint8_t* from = bufs[lastPublished];
  uint8_t* to = bufs[back];
  if (identity) {
    memcpy(to + (size_t)first * 3, from + (size_t)first * 3, (size_t)(end - first) * 3);
    return;
  }
  for (int p = first; p < end; p++) {
    const size_t o = (size_t)lut[p] * 3;
    to[o] = from[o];
    to[o + 1] = from[o + 1];
    to[o + 2] = from[o + 2];
  }
}

inline int universeEnd(int k) {
  const int end = (k + 1) * c.ppu;
  return end < PIXELS ? end : PIXELS;
}

// Universes the frame never got keep the last published frame's pixels.
inline void fillMissing() {
  for (int k = 0; k < universes; k++) {
    if (seenTest(k)) continue;
    keepPrevious(k * c.ppu, universeEnd(k));
    missCount[k]++;
  }
}

inline void publish(uint32_t now) {
  const bool complete = seenCount >= universes;
  const bool synced = syncMode.load(std::memory_order_relaxed);
  const uint32_t span = lastPacketUs - frameFirstUs;
  // A synced frame can gather packets from several bursts; its span says
  // nothing about how fast one burst arrives.
  if (!synced) {
    noteMax(burstUsMax, span);
    burstSum += span;
    burstN++;
  }
  if (!complete) fillMissing();
  const uint8_t done = back;
  const uint8_t old = readySlot.exchange((uint8_t)(done | FRESH), std::memory_order_acq_rel);
  if (old & FRESH) skipped.fetch_add(1, std::memory_order_relaxed);
  back = old & 3;
  lastPublished = done;
  // frames before incomplete, and appendStats reads them the other way
  // round: a reader never sees more incomplete frames than frames.
  frames.fetch_add(1, std::memory_order_release);
  if (!complete) {
    incomplete.fetch_add(1, std::memory_order_release);
    if (!synced) {
      lossy.fetch_add(1, std::memory_order_relaxed);
      if (frameIdle) lossyIdle.fetch_add(1, std::memory_order_relaxed);
    }
  }
  lastFrameMs.store(now ? now : 1, std::memory_order_release);
  frameOpen = false;
}

inline void onDmx(const uint8_t* b, int len, uint32_t ip, uint32_t now) {
  if (len < 18) { ignored.fetch_add(1, std::memory_order_relaxed); return; }
  const int portAddress = ((b[15] & 0x7F) << 8) | b[14];
  const int k = portAddress - (int)c.universe;
  if (k < 0 || k >= universes) { ignored.fetch_add(1, std::memory_order_relaxed); return; }
  // Length is the sender's claim; the datagram is the fact. Only what both
  // say arrived is written - a short universe writes its first pixels only.
  int n = (b[16] << 8) | b[17];
  if (n > 512) n = 512;
  if (n > len - 18) n = len - 18;
  packets.fetch_add(1, std::memory_order_relaxed);
  lastSender.store(ip, std::memory_order_relaxed);
  lastDmxIp = ip;

  if (!frameOpen) openFrame(now);
  else if (!syncMode.load(std::memory_order_relaxed) && seenTest(k)) {
    // A universe the open frame already holds: the next frame has begun
    // and this one will not be finished.
    publish(now);
    openFrame(now);
  }
  // Idle since the previous packet of this frame: no backlog at that moment.
  if ((int32_t)(idleUs - lastPacketUs) > 0) frameIdle = true;
  lastPacketMs = now;
  lastPacketUs = micros();

  const uint8_t* d = b + 18;
  int count = n / 3;
  if (count > c.ppu) count = c.ppu;
  const int first = k * c.ppu;
  if (first + count > PIXELS) count = PIXELS - first;
  uint8_t* to = bufs[back];
  const uint8_t r = perm[0], g = perm[1], bl = perm[2];
  if (identity) {
    // The panel's own raster: the universe is one contiguous run.
    uint8_t* px = to + (size_t)first * 3;
    if (rgbOrder) {
      memcpy(px, d, (size_t)count * 3);
    } else {
      for (int i = 0; i < count; i++, d += 3, px += 3) {
        px[0] = d[r];
        px[1] = d[g];
        px[2] = d[bl];
      }
    }
  } else {
    for (int i = 0; i < count; i++, d += 3) {
      uint8_t* px = to + (size_t)lut[first + i] * 3;
      px[0] = d[r];
      px[1] = d[g];
      px[2] = d[bl];
    }
  }
  if (!seenTest(k)) {
    // A short universe: the pixels it did not carry are the previous
    // frame's, not whatever this buffer held two frames ago.
    if (first + count < universeEnd(k)) keepPrevious(first + count, universeEnd(k));
    seenSet(k);
    seenCount++;
  }
  if (!syncMode.load(std::memory_order_relaxed) && seenCount >= universes) publish(now);
}

inline void onSync(uint32_t ip, uint32_t now) {
  // "a node shall compare the source IP of the ArtSync to the source IP of
  // the most recent ArtDmx packet. The ArtSync shall be ignored if the IP
  // addresses do not match."
  if (lastDmxIp != 0 && ip != lastDmxIp) { ignored.fetch_add(1, std::memory_order_relaxed); return; }
  syncMode.store(true, std::memory_order_relaxed);
  lastSyncMs = now;
  if (frameOpen) publish(now);
}

inline void sendPollReplies(uint32_t to);

inline void schedulePoll(uint32_t ip, uint32_t now) {
  if (pollTarget == ip || pollQueued == ip) return;   // already on its way
  // One reply is being sent at a time; a second poller waits its turn.
  if (pollTarget) { pollQueued = ip; return; }
  pollTarget = ip;
  pollNextK = 0;
  // "The device should wait for a random delay of up to 1s before sending
  // the reply." Half that keeps a sender's device list snappy.
  pollDueMs = now + (esp_random() % 500);
}

inline void putStr(uint8_t* at, size_t cap, const char* s) {
  size_t n = strlen(s);
  if (n > cap - 1) n = cap - 1;
  memcpy(at, s, n);
}

// What the reply says about this node, refreshed once a second by the
// pf-artnet task. Taken there, not where the reply is built: on the raw path
// replies are sent from inside lwIP's tcpip thread, which must not call back
// into the Wi-Fi or netif APIs.
inline portMUX_TYPE idMux = portMUX_INITIALIZER_UNLOCKED;
inline uint8_t idIp[4] = {0, 0, 0, 0};
inline uint8_t idMac[6] = {0, 0, 0, 0, 0, 0};
inline char idLongName[64] = "Patternflow";
inline uint32_t idAtMs = 0;

inline void refreshIdentity(uint32_t now) {
  if (idAtMs && now - idAtMs < 1000) return;
  idAtMs = now ? now : 1;
  IPAddress me = WiFi.localIP();
  if ((uint32_t)me == 0) me = WiFi.softAPIP();
  uint8_t mac[6] = {};
  WiFi.macAddress(mac);
  const char* host = WiFi.getHostname();
  char name[64];
  snprintf(name, sizeof(name), "Patternflow %s %dx%d", host ? host : "", W, H);
  portENTER_CRITICAL(&idMux);
  for (int i = 0; i < 4; i++) idIp[i] = me[i];
  memcpy(idMac, mac, 6);
  memcpy(idLongName, name, sizeof(idLongName));
  portEXIT_CRITICAL(&idMux);
}

// False when the stack has no buffer for it right now; the caller retries.
inline bool sendDatagram(const uint8_t* data, size_t len, uint32_t to) {
  if (pcb) {
    // Raw path: we are in the tcpip thread, so lwIP is called directly.
    pbuf* q = pbuf_alloc(PBUF_TRANSPORT, (u16_t)len, PBUF_RAM);
    if (!q) return false;
    memcpy(q->payload, data, len);
    ip_addr_t dst = {};
    ip_addr_set_ip4_u32(&dst, to);
    const err_t e = udp_sendto(pcb, q, &dst, PF_ARTNET_PORT);
    pbuf_free(q);
    return e == ERR_OK;
  }
  sockaddr_in dst = {};
  dst.sin_family = AF_INET;
  dst.sin_port = htons(PF_ARTNET_PORT);
  dst.sin_addr.s_addr = to;
  return sendto(sock, data, len, 0, (sockaddr*)&dst, sizeof(dst)) >= 0;
}

// "#0001 [nnnn] text" without printf: on the raw path this runs on lwIP's
// 2,560-byte tcpip stack, where newlib's vfprintf frame alone is ~1 KB.
inline void buildReport(char* out, size_t cap, uint32_t counter, const char* text) {
  char head[13] = "#0001 [0000]";
  for (int i = 0; i < 4; i++) {
    head[10 - i] = (char)('0' + counter % 10);
    counter /= 10;
  }
  size_t n = 0;
  for (const char* p = head; *p && n + 1 < cap; ++p) out[n++] = *p;
  if (n + 1 < cap) out[n++] = ' ';
  for (const char* p = text; *p && n + 1 < cap; ++p) out[n++] = *p;
  out[n] = 0;
}

// Sends the replies for universes pollNextK.. in slices of at most `budget`,
// so neither path holds the stack for 49 sends in a row; a full TX queue
// ends the slice and the same universe is tried again on the next call.
// True once every universe has been answered.
inline bool sendPollReplies(uint32_t to, int budget) {
  uint8_t me[4], mac[6];
  char longName[64];
  portENTER_CRITICAL(&idMux);
  memcpy(me, idIp, 4);
  memcpy(mac, idMac, 6);
  memcpy(longName, idLongName, sizeof(longName));
  portEXIT_CRITICAL(&idMux);
  longName[sizeof(longName) - 1] = 0;
  const bool live = lastFrameMs.load() && millis() - lastFrameMs.load() < c.timeoutMs;
  if (pollNextK == 0) pollReplies = (pollReplies + 1) % 10000;
  char report[64];
  buildReport(report, sizeof(report), pollReplies, live ? "receiving" : "waiting for ArtDmx");

  for (; pollNextK < universes && budget > 0; budget--) {
    const int k = pollNextK;
    const int pa = ((int)c.universe + k) & 0x7FFF;
    uint8_t* r = reply;
    memset(r, 0, POLL_REPLY_BYTES);
    memcpy(r, "Art-Net", 8);
    r[8] = OP_POLL_REPLY & 0xFF;
    r[9] = OP_POLL_REPLY >> 8;
    r[10] = me[0]; r[11] = me[1]; r[12] = me[2]; r[13] = me[3];
    r[14] = PF_ARTNET_PORT & 0xFF;          // Port, low byte first
    r[15] = PF_ARTNET_PORT >> 8;
    r[16] = 0; r[17] = 1;                   // VersInfo
    r[18] = (pa >> 8) & 0x7F;               // NetSwitch
    r[19] = (pa >> 4) & 0x0F;               // SubSwitch
    r[20] = PF_ARTNET_OEM >> 8;             // OemHi
    r[21] = PF_ARTNET_OEM & 0xFF;           // Oem
    r[23] = 0xE0;                           // Status1: indicators normal, Port-Address set over the network
    r[24] = PF_ARTNET_ESTA & 0xFF;          // EstaManLo
    r[25] = PF_ARTNET_ESTA >> 8;            // EstaManHi
    putStr(r + 26, 18, "Patternflow");      // PortName (the "short name")
    putStr(r + 44, 64, longName);           // LongName
    putStr(r + 108, 64, report);            // NodeReport
    r[173] = 1;                             // NumPortsLo: one output per reply
    r[174] = 0x80;                          // PortTypes[0]: output from Art-Net, DMX512
    r[182] = live ? 0x80 : 0x00;            // GoodOutputA[0]: data is being output
    r[190] = pa & 0x0F;                     // SwOut[0]
    r[200] = 0x00;                          // Style: StNode
    memcpy(r + 201, mac, 6);                // MAC, high byte first
    r[207] = me[0]; r[208] = me[1]; r[209] = me[2]; r[210] = me[3];  // BindIp: the root is us
    r[211] = (uint8_t)(k + 1);              // BindIndex: one bound "page" per universe
    r[212] = 0x09;                          // Status2: 15-bit Port-Address, web configuration
    if (!sendDatagram(r, POLL_REPLY_BYTES, to)) return false;
    pollNextK++;
  }
  if (pollNextK < universes) return false;
  polls.fetch_add(1, std::memory_order_relaxed);
  return true;
}

inline void onPacket(int len, uint32_t ip, uint32_t now) {
  if (len < 10 || memcmp(pkt, "Art-Net", 8) != 0) return;   // not Art-Net at all: not ours to count
  const uint16_t op = pkt[8] | (pkt[9] << 8);
  if (!enabled.load(std::memory_order_relaxed)) return;
  switch (op) {
    case OP_DMX: onDmx(pkt, len, ip, now); break;
    case OP_SYNC: onSync(ip, now); break;
    case OP_POLL: schedulePoll(ip, now); break;
    default: ignored.fetch_add(1, std::memory_order_relaxed); break;
  }
}

// One datagram in pkt, timed: the diagnostics' procUs.
inline void handle(int len, uint32_t ip) {
  const uint32_t t0 = micros();
  onPacket(len, ip, millis());
  const uint32_t us = micros() - t0;
  noteMax(procUsMax, us);
  procSum += us;
  procN++;
}

inline void handleReset() {
  if (!resetRequested.exchange(false)) return;
  // `shown` and its rate belong to the loop task and are reset there
  // (resetCounters), or its next rate sample would wrap.
  packets = 0; ignored = 0; frames = 0; incomplete = 0; skipped = 0; polls = 0;
  queueMax = 0; procUsMax = 0; procUsAvg = 0; burstUsMax = 0; burstUsAvg = 0;
  lossy = 0; lossyIdle = 0;
  procSum = procN = burstSum = burstN = 0;
  procSum0 = procN0 = burstSum0 = burstN0 = 0;
  memset(missCount, 0, MAX_UNIVERSES * sizeof(uint32_t));
  ratePackets = 0; rateFrames = 0; rateAtMs = 0;
}

inline void housekeeping(uint32_t now) {
  if (syncMode.load(std::memory_order_relaxed) && now - lastSyncMs >= PF_ARTNET_SYNC_TIMEOUT_MS) {
    syncMode.store(false, std::memory_order_relaxed);
  }
  // Without ArtSync, an unfinished frame is shown once the sender has been
  // quiet for `gap` ms - silence after its latest packet, not time since its
  // first, so a burst that is merely slow to arrive is not cut in two.
  if (frameOpen && !syncMode.load(std::memory_order_relaxed) && now - lastPacketMs >= c.gapMs) {
    publish(now);
  }
  if (pollTarget && (int32_t)(now - pollDueMs) >= 0 && sendPollReplies(pollTarget, 8)) {
    pollTarget = pollQueued;
    pollQueued = 0;
    pollNextK = 0;
    pollDueMs = now;
  }
  if (now - rateAtMs >= 1000) {
    const uint32_t p = packets.load(), f = frames.load();
    const uint32_t dt = now - rateAtMs;
    if (rateAtMs) {
      ppsNow.store((p - ratePackets) * 1000 / dt);
      rxFpsX10.store((f - rateFrames) * 10000 / dt);
    }
    ratePackets = p;
    rateFrames = f;
    rateAtMs = now;
    if (procN != procN0) procUsAvg.store((procSum - procSum0) / (procN - procN0));
    if (burstN != burstN0) burstUsAvg.store((burstSum - burstSum0) / (burstN - burstN0));
    procSum0 = procSum; procN0 = procN; burstSum0 = burstSum; burstN0 = burstN;
  }
}

// ── Socket path: the pf-artnet task reads, handles and keeps house ──────
inline void socketWorker(void*) {
  for (;;) {
    syncConfig();
    handleReset();
    sockaddr_in from = {};
    socklen_t fromLen = sizeof(from);
    // Blocks for at most SO_RCVTIMEO (5 ms): long enough to cost the core
    // nothing, short enough for the gap timeout and a pending poll reply.
    const int len = recvfrom(sock, pkt, sizeof(pkt), 0, (sockaddr*)&from, &fromLen);
    if (len > 0) {
      // How many more universes are already waiting behind this one. This
      // task runs above tcpip on the same core, so the six-slot mailbox can
      // only back up while it is busy elsewhere (answering a poll). A slow
      // receiver does not show here: it starves tcpip instead - judge that
      // from procUs against the burst's packet spacing, and rx=raw.
      int avail = 0;
      if (lwip_ioctl(sock, FIONREAD, &avail) == 0 && avail > 0) {
        const int unit = 18 + 3 * c.ppu;   // one full universe
        uint32_t q = (uint32_t)((avail + unit - 1) / unit);
        if (q > CONFIG_LWIP_UDP_RECVMBOX_SIZE) q = CONFIG_LWIP_UDP_RECVMBOX_SIZE;
        noteMax(queueMax, q);
      }
      handle(len, from.sin_addr.s_addr);
    }
    const uint32_t now = millis();
    refreshIdentity(now);
    housekeeping(now);
    // Once a second: the scan walks the free stack byte by byte, and this
    // loop runs once per datagram above tcpip's priority.
    if (now - stackAtMs >= 1000) {
      stackAtMs = now;
      stackMin.store(uxTaskGetStackHighWaterMark(nullptr), std::memory_order_relaxed);
    }
  }
}

inline bool startSocket() {
  sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
  if (sock < 0) return false;
  int one = 1;
  setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));
  // Broadcast in both directions: ArtSync is broadcast by definition, and
  // some senders broadcast ArtDmx too (not allowed by Art-Net 4, common
  // anyway). Harmless where lwIP delivers broadcast regardless.
  setsockopt(sock, SOL_SOCKET, SO_BROADCAST, &one, sizeof(one));
  timeval tv = {0, 5000};
  setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
  // Bytes, not datagrams: the six-slot mailbox is the real limit.
  int rcv = 32 * 1024;
  setsockopt(sock, SOL_SOCKET, SO_RCVBUF, &rcv, sizeof(rcv));
  sockaddr_in addr = {};
  addr.sin_family = AF_INET;
  addr.sin_port = htons(PF_ARTNET_PORT);
  addr.sin_addr.s_addr = htonl(INADDR_ANY);
  if (bind(sock, (sockaddr*)&addr, sizeof(addr)) < 0) {
    close(sock);
    sock = -1;
    return false;
  }
  if (xTaskCreatePinnedToCore(socketWorker, "pf-artnet", PF_ARTNET_TASK_STACK, nullptr,
                              PF_ARTNET_TASK_PRIO, &task, 0) != pdPASS) {
    close(sock);
    sock = -1;
    task = nullptr;
    return false;
  }
  rxPath.store(RxSocket);
  return true;
}

// ── Raw path: lwIP calls us from its tcpip thread ───────────────────────
// Every function below runs in the tcpip thread, so the receive state has
// one owner, as on the socket path. The pf-artnet task only refreshes the
// node identity and posts a tick (housekeeping, config, reset) into tcpip
// every 5 ms; it never touches the receive state itself.
inline void rawRecv(void*, udp_pcb*, pbuf* p, const ip_addr_t* addr, u16_t) {
  if (!p) return;
  const int len = pbuf_copy_partial(p, pkt, sizeof(pkt), 0);
  pbuf_free(p);   // returns the Wi-Fi buffer at once - the point of this path
  syncConfig();
  handle(len, addr ? ip4_addr_get_u32(ip_2_ip4(addr)) : 0);
}

inline uint32_t tcpipStackAtMs = 0;
inline void rawTick(void*) {
  syncConfig();
  handleReset();
  const uint32_t now = millis();
  housekeeping(now);
  if (now - tcpipStackAtMs >= 1000) {   // this IS the tcpip thread's stack
    tcpipStackAtMs = now;
    tcpipStackMin.store(uxTaskGetStackHighWaterMark(nullptr), std::memory_order_relaxed);
  }
}

inline std::atomic<int> rawBindState{0};   // 0 pending, 1 bound, -1 failed
inline std::atomic<bool> rawAbandoned{false};

inline void rawUnbind(void*) {
  if (pcb) udp_remove(pcb);
  pcb = nullptr;
}

inline void rawBind(void*) {
  if (rawAbandoned.load()) { rawBindState.store(-1); return; }   // the caller gave up waiting
  udp_pcb* q = udp_new();
  if (!q) { rawBindState.store(-1); return; }
  if (udp_bind(q, IP_ADDR_ANY, PF_ARTNET_PORT) != ERR_OK) {
    udp_remove(q);
    rawBindState.store(-1);
    return;
  }
  pcb = q;
  udp_recv(q, rawRecv, nullptr);
  rawBindState.store(1);
}

inline void rawWorker(void*) {
  for (;;) {
    vTaskDelay(pdMS_TO_TICKS(5) > 0 ? pdMS_TO_TICKS(5) : 1);
    const uint32_t now = millis();
    refreshIdentity(now);
    // Fails while tcpip's mailbox is full (mid-burst); the next tick follows.
    tcpip_try_callback(rawTick, nullptr);
    if (now - stackAtMs >= 1000) {
      stackAtMs = now;
      stackMin.store(uxTaskGetStackHighWaterMark(nullptr), std::memory_order_relaxed);
    }
  }
}

inline bool startRaw() {
  refreshIdentity(millis());
  rawBindState.store(0);
  rawAbandoned.store(false);
  if (tcpip_callback(rawBind, nullptr) != ERR_OK) return false;
  for (int i = 0; i < 2000 && rawBindState.load() == 0; i++) vTaskDelay(1);
  if (rawBindState.load() == 0) {
    // tcpip has not got to it in ~2 s; make sure it never binds behind our back.
    rawAbandoned.store(true);
    return false;
  }
  if (rawBindState.load() != 1) return false;
  if (xTaskCreatePinnedToCore(rawWorker, "pf-artnet", PF_ARTNET_TASK_STACK, nullptr,
                              PF_ARTNET_TASK_PRIO, &task, 0) != pdPASS) {
    // Without the worker nothing would ever time a frame out or answer a
    // poll; give the port back so a later attempt (or the socket) can have it.
    task = nullptr;
    tcpip_callback(rawUnbind, nullptr);
    return false;
  }
  rxPath.store(RxRaw);
  return true;
}

inline bool start() {
  if (task) return true;
  if (!allocated()) return false;
  return rawWanted ? startRaw() : startSocket();
}
}  // namespace ArtnetRx

// ── Boot ────────────────────────────────────────────────────────────────
inline void setup() {
  loadConfig();
  for (int i = 0; i < 3; i++) bufs[i] = (uint8_t*)PFMem::alloc(FRAME_BYTES);
  overlayOut = (uint8_t*)PFMem::alloc(FRAME_BYTES);
  lut = (uint16_t*)PFMem::alloc(PIXELS * sizeof(uint16_t));
  missCount = (uint32_t*)PFMem::alloc(MAX_UNIVERSES * sizeof(uint32_t));
  if (!allocated()) Serial.println("[ARTNET] buffers unavailable - feature off");
  esp_register_freertos_idle_hook_for_cpu(idleHook, 0);
  // Features' setup() runs before the core starts Wi-Fi (patternflow.ino),
  // which is the only moment this can still take effect.
  if (wifiStaticWanted) {
    WiFi.useStaticBuffers(true);
    wifiStatic.store(true);
    Serial.println("[ARTNET] Wi-Fi with static buffers (experiment)");
  }
}

// The Wi-Fi edge (and every reconnect): the socket is bound to every
// interface, so it is opened once and survives an address change.
inline void begin() {
  if (ArtnetRx::task) return;
  if (ArtnetRx::start()) {
    Serial.printf("[ARTNET] listening on udp %u, Core 0, %s path\n", (unsigned)PF_ARTNET_PORT,
                  rxPath.load() == RxRaw ? "raw" : "socket");
  } else {
    Serial.println("[ARTNET] could not open the socket or start the task");
  }
}

// ── The render side (loop task) ─────────────────────────────────────────
inline bool running = true;
inline uint32_t shownRateAtMs = 0, shownRateCount = 0;

inline void noteFrame(const PFFeatureFrame& f) {
  running = f.running;
  const uint32_t now = millis();
  if (now - shownRateAtMs >= 1000) {
    const uint32_t s = shown.load();
    if (shownRateAtMs) shownFpsX10.store((s - shownRateCount) * 10000 / (now - shownRateAtMs));
    shownRateCount = s;
    shownRateAtMs = now;
  }
}

// True while a stream is fresh enough to be shown.
inline bool live() {
  const uint32_t last = lastFrameMs.load(std::memory_order_acquire);
  return last != 0 && millis() - last <= cfg.timeoutMs;
}

inline const uint8_t* compose(const uint8_t* frame, int w, int h) {
  if (!enabled.load(std::memory_order_relaxed) || !running) return nullptr;
  if (CalibPattern::overrideOn) return nullptr;
  if (w != W || h != H || !allocated() || !live()) return nullptr;

  if (readySlot.load(std::memory_order_acquire) & FRESH) {
    const uint8_t old = readySlot.exchange(frontIdx, std::memory_order_acq_rel);
    frontIdx = old & 3;
    shown.fetch_add(1, std::memory_order_relaxed);
  }
  const uint8_t* src = bufs[frontIdx];
  if (cfg.mode == ModeReplace) return src;

  // Overlay: the stream where it is lit, the pattern where it is dark.
  const uint8_t t = cfg.threshold;
  uint8_t* out = overlayOut;
  for (int i = 0; i < PIXELS; i++, src += 3, frame += 3, out += 3) {
    const uint8_t* use = (src[0] > t || src[1] > t || src[2] > t) ? src : frame;
    out[0] = use[0];
    out[1] = use[1];
    out[2] = use[2];
  }
  return overlayOut;
}

// From the HTTP handler, on the loop task: the loop's own counters are
// reset here, the receiver's by the receiver at its next turn.
inline void resetCounters() {
  shown.store(0);
  shownRateCount = 0;
  shownRateAtMs = 0;
  resetRequested.store(true);
}

inline void ipString(uint32_t ip, char* out, size_t n) {
  const uint8_t* b = (const uint8_t*)&ip;
  if (!ip) { out[0] = 0; return; }
  snprintf(out, n, "%u.%u.%u.%u", b[0], b[1], b[2], b[3]);
}

// The state both /api/status and /api/artnet report, as `"key":value` pairs
// without braces.
inline void appendStats(String& json) {
  char ip[16];
  ipString(lastSender.load(), ip, sizeof(ip));
  const uint32_t last = lastFrameMs.load();
  json += "\"on\":";
  json += enabled.load() ? "true" : "false";
  json += ",\"active\":";
  json += (enabled.load() && live()) ? "true" : "false";
  json += ",\"listening\":";
  json += ArtnetRx::task ? "true" : "false";
  json += ",\"mode\":\"";
  json += cfg.mode == ModeOverlay ? "overlay" : "replace";
  json += "\",\"sync\":";
  json += syncMode.load() ? "true" : "false";
  json += ",\"fps\":";
  json += String(rxFpsX10.load() / 10.0f, 1);
  json += ",\"shownFps\":";
  json += String(shownFpsX10.load() / 10.0f, 1);
  json += ",\"pps\":";
  json += ppsNow.load();
  const uint32_t inc = incomplete.load(std::memory_order_acquire);   // first: see publish()
  const uint32_t fr = frames.load(std::memory_order_acquire);
  json += ",\"frames\":";
  json += fr;
  json += ",\"incomplete\":";
  json += inc;
  json += ",\"skipped\":";
  json += skipped.load();
  json += ",\"packets\":";
  json += packets.load();
  json += ",\"ignored\":";
  json += ignored.load();
  json += ",\"polls\":";
  json += polls.load();
  json += ",\"sender\":\"";
  json += ip;
  json += "\",\"ageMs\":";
  json += last ? (long)(millis() - last) : -1L;
  json += ",\"universes\":";
  json += universesFor(cfg.ppu);
  json += ",\"stackMin\":";
  json += stackMin.load();
  // Diagnostics (docs: README "Finding where packets go missing").
  json += ",\"rx\":\"";
  json += rxPath.load() == RxRaw ? "raw" : (rxPath.load() == RxSocket ? "socket" : "none");
  json += "\",\"queueMax\":";
  json += queueMax.load();
  json += ",\"procUs\":";
  json += procUsAvg.load();
  json += ",\"procUsMax\":";
  json += procUsMax.load();
  json += ",\"burstUs\":";
  json += burstUsAvg.load();
  json += ",\"burstUsMax\":";
  json += burstUsMax.load();
  json += ",\"lossy\":";
  json += lossy.load();
  json += ",\"lossyIdle\":";
  json += lossyIdle.load();
  json += ",\"tcpipStackMin\":";
  json += tcpipStackMin.load();
  json += ",\"wifiStatic\":";
  json += wifiStatic.load() ? "true" : "false";
}

// Per universe, how many published frames went without it: a run of high
// counts at the end means bursts lose their tail.
inline void appendMissing(String& json) {
  json += "\"miss\":[";
  const int n = universesFor(cfg.ppu);
  for (int k = 0; k < n && missCount; k++) {
    if (k) json += ',';
    json += missCount[k];
  }
  json += "]";
}

}  // namespace PatternflowArtnet
