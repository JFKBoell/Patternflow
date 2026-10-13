// ═══════════════════════════════════════════════════════════
// PatternFlow - Art-Net feature: compile-time defaults
//
// Read only when a composition carries features/artnet/. Every value is
// #ifndef-guarded: patternflow_secrets.h (per device) and a composition's
// overrides.h (per edition) are included before this through config.h, so
// whatever they define wins and the lines below fill in the rest.
//
// Settings TUNE the feature; what a person changes on /artnet lives in NVS
// (namespace "artnet") and outranks the defaults below from the first save.
// License: MIT
// ═══════════════════════════════════════════════════════════
#pragma once
#include "../../config.h"

#ifndef PF_ARTNET_ENABLED
#define PF_ARTNET_ENABLED 1
#endif
#ifndef PF_ARTNET_HTTP_ENABLED
#define PF_ARTNET_HTTP_ENABLED PF_ARTNET_ENABLED
#endif

// The Art-Net UDP port. 6454 (0x1936) is fixed by the specification; it is a
// define only so a test bench can move it.
#ifndef PF_ARTNET_PORT
#define PF_ARTNET_PORT 6454
#endif

// The Port-Address (Net:7 | Sub-Net:4 | Universe:4, 15 bits) the first pixel
// arrives on. Art-Net 4 calls 0 deprecated (sACN compatibility), but it is
// what most senders start at out of the box, so it is the default here.
#ifndef PF_ARTNET_DEFAULT_UNIVERSE
#define PF_ARTNET_DEFAULT_UNIVERSE 0
#endif

// Pixels per universe. 170 is 510 of 512 channels in RGB, the convention
// every pixel-mapping tool defaults to.
#ifndef PF_ARTNET_DEFAULT_PPU
#define PF_ARTNET_DEFAULT_PPU 170
#endif

// No complete frame for this long and the panel goes back to the pattern.
#ifndef PF_ARTNET_DEFAULT_TIMEOUT_MS
#define PF_ARTNET_DEFAULT_TIMEOUT_MS 2000
#endif

// Without ArtSync: a frame that has started but is not complete is shown
// anyway once this long has passed since its first packet. A lost packet
// otherwise holds the frame until the next one starts. Senders that pace
// their universes across the whole frame interval need this raised.
#ifndef PF_ARTNET_DEFAULT_GAP_MS
#define PF_ARTNET_DEFAULT_GAP_MS 20
#endif

// Overlay mode: a stream pixel whose brightest channel is at or below this
// lets the pattern through.
#ifndef PF_ARTNET_DEFAULT_THRESHOLD
#define PF_ARTNET_DEFAULT_THRESHOLD 8
#endif

// Art-Net 4: "a node shall time out to non-synchronous operation if an
// ArtSync is not received for 4 seconds or more."
#ifndef PF_ARTNET_SYNC_TIMEOUT_MS
#define PF_ARTNET_SYNC_TIMEOUT_MS 4000
#endif

// The receive task: Core 0, beside the network task and lwIP. The stack is
// internal RAM (FreeRTOS does not put stacks in PSRAM), so it is kept small:
// the packet buffer is a static, not a local.
#ifndef PF_ARTNET_TASK_STACK
#define PF_ARTNET_TASK_STACK 4096
#endif
// Above lwIP's tcpip task (18 in this SDK), below the Wi-Fi driver (23).
// The precompiled lwIP gives a UDP socket a mailbox of SIX datagrams
// (CONFIG_LWIP_UDP_RECVMBOX_SIZE 6 in the Arduino 2.0.17 sdkconfig), and a
// frame is 49 of them in a burst. A task below tcpip only runs once tcpip has
// worked through its whole queue - by then the mailbox has overflowed. Above
// it, every post wakes this task at once, the packet is copied out (tens of
// microseconds) and the task blocks again.
#ifndef PF_ARTNET_TASK_PRIO
#define PF_ARTNET_TASK_PRIO 19
#endif

// Discovery identity. The specification asks every manufacturer to register
// an OEM code with Artistic Licence; this project has none, so the reply
// carries 0x00FF ("unknown OEM") and ESTA code 0 until one is registered.
#ifndef PF_ARTNET_OEM
#define PF_ARTNET_OEM 0x00FF
#endif
#ifndef PF_ARTNET_ESTA
#define PF_ARTNET_ESTA 0x0000
#endif
