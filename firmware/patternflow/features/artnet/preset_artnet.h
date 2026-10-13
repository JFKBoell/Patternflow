// SPDX-License-Identifier: MIT
// Pattern: Art-Net
// A black frame and nothing else - the cheapest thing a pattern can draw.
//
// The stream is shown on the frame's way to the panel (composeFrame), so it
// moves only as fast as the running pattern presents. Under a heavy pattern
// the panel would cap the stream at that pattern's frame rate and spend the
// rest of the frame computing pixels nobody sees. Pick this one to stream:
// the frame costs a clear and a blit, and when the stream stops (the timeout
// on /artnet) the panel goes dark instead of falling back to a pattern.
//
// Brought in by the Art-Net edition's overrides.h (PF_FEATURE_PRESETS), not
// by the feature: a composition carrying features/artnet may leave it out.
#pragma once

#include "../../src/core_canvas.h"
#include "../../src/core_encoders.h"

namespace ArtnetStream {
  const char* NAME = "Art-Net";
  const char* KNOB_LABELS[4] = {"-", "-", "-", "-"};
  constexpr bool ABSOLUTE_READY = false;

  void setup() {}
  void update(float /*dt*/, const InputFrame& /*input*/) {}

  void draw() {
    PFCanvas::resetFrame();
    PFCanvas::clear();
    PFCanvas::present();
  }
}
