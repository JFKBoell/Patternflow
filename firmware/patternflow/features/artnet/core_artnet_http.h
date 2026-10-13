// ═══════════════════════════════════════════════════════════
// PatternFlow - /artnet page and /api/artnet
//
//   GET  /artnet        the page
//   GET  /api/artnet    every setting, and the receiver's state
//   POST /api/artnet    any subset of (form-encoded or query string):
//        on=0|1            the switch (also K2 on the NETWORK screen)
//        mode=replace|overlay
//        thr=0..255        overlay: a stream pixel at or below this shows the pattern
//        uni=0..32767      Port-Address of the first universe
//        ppu=16..170       pixels per universe
//        order=RGB|RBG|GRB|GBR|BRG|BGR
//        serp=0|1          odd rows right-to-left
//        rot=0..3          quarter turns (1 = upright)
//        fx=0|1  fy=0|1    mirror the sender's raster
//        timeout=100..60000  ms without a frame before the pattern returns
//        gap=2..200        ms of silence after which an unsynced, unfinished frame is shown
//        rx=socket|raw     the receive path for the NEXT boot (see core_artnet.h)
//        wifibuf=0|1       experiment, NEXT boot: start Wi-Fi with static buffers (~19 KB internal RAM)
//        reset=1           zero the counters and the diagnostics
//      - persisted in NVS ("artnet"), answers as GET
//
// The settings are written on the render core (core_loop_sync.h), the rule
// every feature's config handler follows; compose reads them there.
//
// The page is a plain PROGMEM literal served as is (PFSend::progmem), not
// a console/ page spliced and gzipped by console_pages.py: that pipeline is
// a list in a core tool, and this feature adds files without editing any.
//
// License: MIT
// ═══════════════════════════════════════════════════════════
#pragma once
#include "artnet_config.h"

#include "../../net_config.h"
#include "../../src/core_patterns_http.h"
#include "../../src/core_loop_sync.h"

#if PF_ARTNET_HTTP_ENABLED && PF_PATTERNS_HTTP_ENABLED && PF_ARTNET_ENABLED
#include "../../src/webserver/WebServer.h"  // vendored: see src/webserver/VENDORED.md
#include "../../src/core_send.h"
#include "core_artnet.h"
#include "artnet_index.h"
#endif

namespace PatternflowArtnetHttp {

#if PF_ARTNET_HTTP_ENABLED && PF_PATTERNS_HTTP_ENABLED && PF_ARTNET_ENABLED

inline WebServer& server() { return PatternflowPatternsHttp::server(); }
inline bool initialized = false;

inline void sendState(int code) {
  using namespace PatternflowArtnet;
  const Config c = cfg;
  String json;
  json.reserve(640);
  json = "{\"ok\":true,";
  appendStats(json);
  json += ",\"uni\":";
  json += c.universe;
  json += ",\"ppu\":";
  json += c.ppu;
  json += ",\"order\":\"";
  json += ORDER_NAMES[c.order];
  json += "\",\"serp\":";
  json += c.serpentine ? 1 : 0;
  json += ",\"rot\":";
  json += c.rot;
  json += ",\"fx\":";
  json += c.flipX ? 1 : 0;
  json += ",\"fy\":";
  json += c.flipY ? 1 : 0;
  json += ",\"thr\":";
  json += c.threshold;
  json += ",\"timeout\":";
  json += c.timeoutMs;
  json += ",\"gap\":";
  json += c.gapMs;
  json += ",\"w\":";
  json += W;
  json += ",\"h\":";
  json += H;
  json += ",\"port\":";
  json += PF_ARTNET_PORT;
  json += ",\"rxNext\":\"";
  json += rawWanted ? "raw" : "socket";
  json += "\",\"wifibufNext\":";
  json += wifiStaticWanted ? "true" : "false";
  json += ",";
  appendMissing(json);
  json += "}";
  server().sendHeader("Cache-Control", "no-store");
  server().send(code, "application/json", json);
}

inline void handleIndex() {
  if (PatternflowPatternsHttp::noteConsolePageOpened()) {
    PatternflowPatternsHttp::sendConsoleWakePage();
    return;
  }
  PFSend::progmem(server(), ARTNET_INDEX_HTML);
}

inline void handleGet() {
  PatternflowPatternsHttp::noteConsoleApiCall();
  sendState(200);
}

inline bool flag(const char* name, bool current) {
  if (!server().hasArg(name)) return current;
  const String& v = server().arg(name);
  return v == "1" || v == "true" || v == "on";
}

inline long number(const char* name, long current, long lo, long hi) {
  if (!server().hasArg(name)) return current;
  const String& s = server().arg(name);
  char* end = nullptr;
  long v = strtol(s.c_str(), &end, 10);
  if (!s.length() || !end || *end != '\0' || v < lo || v > hi) return current;
  return v;
}

inline void configOnLoop() {
  using namespace PatternflowArtnet;
  Config c = cfg;
  if (server().hasArg("mode")) {
    const String& m = server().arg("mode");
    if (m == "overlay" || m == "1") c.mode = ModeOverlay;
    else if (m == "replace" || m == "0") c.mode = ModeReplace;
  }
  c.threshold = (uint8_t)number("thr", c.threshold, 0, 255);
  c.universe = (uint16_t)number("uni", c.universe, 0, 32767);
  c.ppu = (uint8_t)number("ppu", c.ppu, PPU_MIN, PPU_MAX);
  if (server().hasArg("order")) {
    String o = server().arg("order");
    o.toUpperCase();
    for (uint8_t i = 0; i < 6; i++) {
      if (o == ORDER_NAMES[i]) c.order = i;
    }
  }
  c.serpentine = flag("serp", c.serpentine);
  c.rot = (uint8_t)number("rot", c.rot, 0, 3);
  c.flipX = flag("fx", c.flipX);
  c.flipY = flag("fy", c.flipY);
  c.timeoutMs = (uint16_t)number("timeout", c.timeoutMs, 100, 60000);
  c.gapMs = (uint8_t)number("gap", c.gapMs, 2, 200);
  setConfig(c);
  if (server().hasArg("on")) setEnabled(flag("on", enabled.load()));
  if (flag("reset", false)) resetCounters();
  if (server().hasArg("rx")) {
    const String& r = server().arg("rx");
    if (r == "raw") rawWanted = true;
    else if (r == "socket") rawWanted = false;
  }
  wifiStaticWanted = flag("wifibuf", wifiStaticWanted);
  saveConfig();
  sendState(200);
}

inline void handleConfig() {
  if (!PFLoopSync::run([] { configOnLoop(); })) PatternflowHttp::sendLoopStalled();
}

inline void begin() {
  if (initialized) return;
  if (!PatternflowWifi::linkUp()) return;
  server().on("/artnet", HTTP_GET, handleIndex);
  server().on("/api/artnet", HTTP_GET, handleGet);
  server().on("/api/artnet", HTTP_POST, handleConfig);
  initialized = true;
  // This line is the feature's marker in bundles/build.sh's binary scan.
  Serial.println("[ARTNET] /artnet ready");
}

#else

inline void begin() {}

#endif

}  // namespace PatternflowArtnetHttp
