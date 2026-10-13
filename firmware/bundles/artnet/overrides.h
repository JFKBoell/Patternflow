// ═══════════════════════════════════════════════════════════
// Patternflow Art-Net — what this edition calls itself, and what it sets
//
// Included from config.h before any default, so anything `#ifndef`-guarded
// anywhere in the tree can be set here. Nothing in this file is a core
// file, and the build script puts it back the way it found it.
//
// Written for this edition, not copied from another one: every line below
// has its own reason, and the preset lines in particular are not the
// Performance edition's (see "Feature presets").
//
// License: MIT
// ═══════════════════════════════════════════════════════════
#pragma once

// Reported in /api/status as `variant` and `variantVersion`, worn as a badge
// on every console page. Without it a panel running this would claim to be
// the core build, and nobody holding it could tell what is on it. The
// version is the edition's own; it says nothing about the core version.
#define PF_VARIANT          "artnet"
#define PF_VARIANT_VERSION  "v0.1.1"

// ── Feature presets ─────────────────────────────────────────────────────
// One pattern rides along: "Art-Net", a black frame (features/artnet/
// preset_artnet.h). The stream is composed into whatever pattern presents,
// so it can never be faster than that pattern; this one costs a clear and a
// blit, which makes it the pattern to stream on, and it shows black rather
// than a pattern when the stream stops.
//
// This is the PF_FEATURE_PRESETS trap from docs/EDITIONS.md, checked: this
// edition does not carry the show player, so the scheduler's hidden `Black`
// is NOT listed - naming it here would fail with "'Black' has not been
// declared", and copying Performance's lines would do exactly that.
#define PF_FEATURE_PRESET_INCLUDE "artnet/preset_artnet.h"
#define PF_FEATURE_PRESETS PATTERN_ENTRY(ArtnetStream),

// Nothing else is changed. The radio stays at the core's power, Wi-Fi power
// save stays as the core sets it (off while awake, core_wifi.h), and a panel
// switching to this edition keeps its Wi-Fi, its brightness and its
// patterns - the rule for being an edition at all.
