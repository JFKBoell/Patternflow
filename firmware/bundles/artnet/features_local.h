// ═══════════════════════════════════════════════════════════
// Patternflow Art-Net — which features this edition carries
//
// The panel as an Art-Net node, and nothing else:
//
//   artnet    49 universes of RGB on UDP 6454, shown in place of the running
//             pattern or over it; ArtSync, ArtPoll discovery, /artnet
//
// Deliberately absent: the clock. It would work - list it AFTER artnet and
// it cuts the time out of the stream, because composeFrame chains in list
// order - but this edition exists to find out how fast a panel can take
// frames over Wi-Fi, and a second full-frame pass per frame is exactly the
// kind of thing that would muddy that number. Add it once the measurements
// are in; it is one include and one line.
//
// License: MIT
// ═══════════════════════════════════════════════════════════
#pragma once

#include "artnet/feature_artnet.h"

#define PF_FEATURE_LIST &PFFeatureArtnet::descriptor
