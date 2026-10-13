// ═══════════════════════════════════════════════════════════
// PatternFlow - Art-Net in, as a feature
//
// The panel as an Art-Net node: Resolume, TouchDesigner, MadMapper or any
// pixel mapper sends 49 universes of RGB on UDP 6454 and the panel shows
// them, instead of the running pattern or over it.
//
// docs/rest-api.md says "the device never streams pixels". That rule is about
// the device SENDING them - a polled frame preview took the render loop down
// - and still stands: nothing here sends a pixel anywhere. Receiving goes
// past the console's one-connection server entirely, on a socket and a task
// of this feature's own.
//
// Hooks: setup (settings, every buffer), onNetwork (socket, task, routes),
// loop (what the frame is doing; the on-panel rate), composeFrame (the
// stream), appendStatus, the runtime-toggle trio for the NETWORK screen, and
// the nav triple. Core edits: none.
//
// License: MIT
// ═══════════════════════════════════════════════════════════
#pragma once

#include "../pf_feature.h"
#include "core_artnet.h"
#include "core_artnet_http.h"

namespace PFFeatureArtnet {

inline void setup() { PatternflowArtnet::setup(); }

inline void onNetwork() {
  PatternflowArtnet::begin();
  PatternflowArtnetHttp::begin();
}

inline void loop(const PFFeatureFrame& frame) { PatternflowArtnet::noteFrame(frame); }

inline const uint8_t* composeFrame(const uint8_t* frame, int w, int h) {
  return PatternflowArtnet::compose(frame, w, h);
}

inline bool isRuntimeEnabled() { return PatternflowArtnet::enabled.load(); }

// From the NETWORK screen, on the loop task. Persisted with the rest of the
// feature's settings, in its own namespace.
inline void setRuntimeEnabled(bool on) {
  PatternflowArtnet::setEnabled(on);
  PatternflowArtnet::saveConfig();
}

inline void appendStatus(String& json) {
  json += ",\"artnet\":{";
  PatternflowArtnet::appendStats(json);
  json += "}";
}

inline const PFFeature descriptor = {
    "artnet",
    "artnet",      // cap - the site and the lab probe for this
    setup,
    onNetwork,
    loop,
    nullptr,       // observeFrame
    nullptr,       // fillInput
    nullptr,       // onUserInput
    nullptr,       // claimsPattern
    nullptr,       // takePattern
    nullptr,       // onSleep
    nullptr,       // requestSleep
    "ARTN",        // shortName - the NETWORK screen row (K2 turns it)
    isRuntimeEnabled,
    setRuntimeEnabled,
    appendStatus,
    nullptr,       // drawOverlay - this feature composes instead
    "/artnet",     // navPath - the console header link
    "Art-Net",     // navLabel
    "Frames from Resolume, TouchDesigner or any pixel mapper over Art-Net: "
    "universes, mapping, and what the receiver sees.",
    composeFrame,
};

}  // namespace PFFeatureArtnet
