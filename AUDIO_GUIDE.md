# Audio Guide — sound driving the four knobs

The **Audio edition** makes sound one of the things that can turn the knobs.
Any pattern that responds to the knobs responds to sound — patterns never
know where knob values come from.

There are two main ways in, and this guide covers both: the **Chrome
extension** (any browser tab becomes the source) and the **on-board
microphone** (a $5 part and five thin leads, and the panel hears the
room with no computer involved). A phone app exists too — it's covered
briefly at the end — and if you work in a DAW, the panel is also a **MIDI
device** ([its own section](#midi--the-panel-as-a-midi-port)) and speaks
OSC ([here](#osc--ableton-today-anything-tomorrow)).

The same ground step by step, on a 3D Patternflow in the browser:
[patternflow.work/guide/audio](https://patternflow.work/guide/audio).

Like the [Feature Guide](FEATURE_GUIDE.md), this page ends with a section
written for AI coding agents; everything above it is for people.

---

## Getting the Audio edition

Any of these puts the same firmware on your panel:

- **One click:** [patternflow.work/editions](https://patternflow.work/editions)
  → Audio → **Install to my panel**. Your browser hands the image to a panel
  that already runs Patternflow, over Wi-Fi; patterns, networks and settings
  stay. A DevKit that has never run Patternflow takes the core first, from
  **Flash Patternflow** ([BUILD_GUIDE §8](BUILD_GUIDE.md#8-firmware)), and
  then this.
- A release's `patternflow-audio.ino.bin` via the console's `/update` page.
- Build it yourself: `./firmware/bundles/build.sh audio` (add
  `flash <hostname>` to send it over Wi-Fi).

The edition bundles four features: **OSC** (Max/TouchDesigner/Ableton, see
[`docs/osc-spec.md`](docs/osc-spec.md)), **audio** (the streaming path the
extension uses), **audio_in** (the microphone and the mapping engine) and
**MIDI** (the panel as a network MIDI port, [`docs/midi-spec.md`](docs/midi-spec.md)).

## The Chrome extension

The fastest way to try sound. It captures whatever a browser tab is playing
— YouTube, SoundCloud, a DJ set, your DAW's browser monitor — analyzes it
locally, and streams four knob lanes to the panel over your LAN.

**Install:** it's not on the Web Store — load it straight from this repo.
`chrome://extensions` → enable *Developer mode* → *Load unpacked* → pick
[`tools/patternflow-audio-extension/`](tools/patternflow-audio-extension/).
After pulling a newer copy, press *Reload* on its card there. Reload keeps the
mapping you already had, so the starting point described below is a new
install's. (Every control is described in its
[README](tools/patternflow-audio-extension/README.md), and so is how to get
that starting point on an older mapping.)

**Use:** open a tab with sound → click the extension → enter your panel's
address (`patternflow.local` or its IP) → **Start** (it captures the active
tab). The corner of the popup says **Live** once the panel is being driven,
and the knobs move with the music. If it says **Aud off**, the panel's
Audio-React switch is off and the panel is ignoring what arrives: press
**Turn on** in the popup. (The same switch is the `AUD` row of the panel's
NETWORK screen and the *Browser extension and phone app* row on the console's
**Audio** page.) If it says **Error**, the line under the address says what
is wrong: no panel at that address, or a panel that does not run the Audio
edition.

While the tab is silent or paused the extension holds the knobs, each where
its band rests, until you press **Stop**. A knob you turn by hand during a
pause goes back there about five seconds after you let go.

**Then open the editor** (*Mapping editor ↗* in the popup) — this is where it gets
good. Each of the four knobs, **K1** to **K4**, is a **box drawn on the live
spectrum**: the box's width is the frequencies it listens to, its height the
loudness window it maps. Drag K1's box over the bass and knob 1 becomes a
bass knob. Pick a knob with the tabs under the plot, and its card has a
**response curve** (presets, or a bezier you drag by its two handles) that
shapes how it moves and an **output range** that decides how far; **Attack**
and **Damping**, above the plot, set the ballistics for all four — fast rise,
slow fall. A new install starts in **Auto range** with the Smooth curve: the
boxes follow the loudness of the music. Drag a box's top or bottom edge to
take the windows over by hand; switching Auto range off goes back to the
windows you set. **Preview** puts a scope where the plot is and shows how a
test signal would ride the selected knob's settings while you change them.

Boxes map to knobs 1:1 and that's fixed on purpose — K2 *is* knob 2.

## The on-board microphone

<img src="docs/images/audio-guide/pdm-mic-wiring.jpg" width="55%">

A small PDM microphone soldered to the DevKit lets the panel react to the
room itself — no browser, no phone, nothing else running. This is an
optional add-on: the firmware ships with the mic **off** and costs nothing
until you solder one on and switch it on.

### What to buy

| Part | What to look for | Notes |
| --- | --- | --- |
| PDM MEMS microphone breakout | **Adafruit PDM MEMS Microphone Breakout #3492** (MP34DT01-M), or any clone whose pin row reads **3V · GND · SEL · CLK · DAT** | ~$5. This is the one in the photo. |
| Hookup wire | 5 thin leads, ~10 cm | Shorter is better — see routing note below. |

**Don't buy these instead:** an **INMP441** or other standard I²S mic (it
needs three signal pins — this board has exactly two free), or an analog
electret module (no ADC pin is free at all). It must be **PDM**.

### Wiring

Five leads, four places on the DevKit (GND takes two):

```
   mic breakout                 ESP32-S3 DevKit
   ┌──────────────┐
   │  3V   ───────┼──────────────►  3V3
   │  GND  ───────┼──────────────►  G   (GND)
   │  SEL  ───────┼──┐
   │  CLK  ───────┼──┼───────────►  TX  (GPIO 43)
   │  DAT  ───────┼──┼───────────►  RX  (GPIO 44)
   └──────────────┘  │
                     └──────────►  G   (GND)   ← SEL goes to ground: the same GND pin
```

- **Don't forget SEL → GND** — it is a lead of its own, soldered to the same
  GND pin as the GND lead. It selects the LEFT channel, the slot a mono read
  uses; tied high, the mic reads silence while looking perfectly healthy.
- The DevKit silkscreen says **TX / RX**, not 43/44 — those are the ones.
  They're free because the console talks over native USB, and they are the
  only two unclaimed pins on the whole board.
- 3V3 and GND appear several times on the headers; use whichever is closest.

**How to physically do it** — the DevKit sits in sockets, so you never touch
the main board:

1. **Pull the DevKit out** of its sockets (straight up).
2. Solder the thin wires on the **top side**, where the header pins poke
   through the module — five wires on four spots: TX, RX, 3V3, and GND
   twice (that's what the photo shows).
3. Route the wires out the top and plug the DevKit back in.

Fully reversible — to undo it, just remove the wires. Two cautions: while
the mic is wired, **don't plug a cable into the DevKit's UART-side USB
port** (that port's bridge chip shares the TX/RX pins — use the native USB
port, which is the one the console uses anyway). And the mic leads run near
the panel's ribbon lines; in practice this is fine (the assembled device
reads clean with the panel running), but if you ever see the picture in the
audio, shorter leads routed away from the ribbon are the first fix.

Stick the mic wherever sound reaches it. Done.

### Turn it on

Console → **Audio** page (`/audio-in`) → under **Sources**, flip
**Microphone** on. That's the whole switch: on means listening and driving
the knobs, off releases the hardware completely. The chip beside it reads
`listening` once samples are arriving, and the line at the top of the page
says who has the knobs. The **Input gain** slider (1–16, default 8) is there
if your room runs quiet — PDM mics on this chip are famously low-amplitude,
and gain is the official answer. (The row under it, *Browser extension and
phone app*, is the other input: the same switch as `AUD` on the panel's
NETWORK screen.)

The same box editor from the extension lives on this page, under
**Mapping**, in the console's own look (light, or dark from the
toggle in the header) — same boxes K1 to K4, same curves, same Preview. Its
level axis is the microphone's, about −45 to +2 dB, and its frequencies stop
at 8 kHz. Changes save to the panel as you make them; mic settings are stored
**on the panel** and survive reboots and firmware updates. *Reset K1* puts the
selected knob back to the firmware's default. *Reset mapping* asks to be
pressed twice and then resets all four knobs, their curves, attack, damping
and input gain; it leaves the Microphone switch and Auto range as they are.

### If something's off

- **Silence, but everything looks healthy** → SEL isn't grounded. This is
  the classic one, and nothing can detect it: a mic with SEL tied high reads
  as a quiet room.
- **The chip says `not detected`** → the firmware sees nothing on the data
  pin: no microphone, or no DAT lead (DAT goes to RX). Nothing is driven.
- **The chip says `not answering`** → the microphone was there and has
  stopped returning samples, or its driver did not start. The knobs are left
  alone in this state too. `source` in `GET /api/audio-in` and in
  `/api/status` has the firmware's own word for each of these.
- **The top band barely moves at normal volume** → physics, not a fault:
  at room levels the highest octaves carry almost no energy. The auto range
  is tuned around this.

## The phone app (for filming)

[`tools/patternflow-audio-android/`](tools/patternflow-audio-android/) is a
small Android app that captures whatever the phone is playing and drives the
panel with it. It exists for one job: **filming content** — play a track on
the phone (reels, whatever), and the panel reacts to the same audio the
video records. For everyday listening the extension or the mic is the better
path.

It's not on any store — build and install it yourself; the
[README](tools/patternflow-audio-android/README.md) has the full recipe. It
opens the panel's own editor page for configuration, so everything above
about boxes and curves applies unchanged.

## MIDI — the panel as a MIDI port

The edition is also a **MIDI device over the network** (RTP-MIDI, the same
protocol macOS calls *Network MIDI*). Once a session is up the panel is an
ordinary MIDI port in any DAW: four knobs in (CC 20–23 absolute, CC 24–27
relative), four buttons (notes 60–63), a pattern selector (Program Change),
and the same four knobs, buttons and pattern changes out as they happen.
The contract is [`docs/midi-spec.md`](docs/midi-spec.md); the walk-through
with screenshots — connecting on macOS, Windows (rtpMIDI) and Linux, mapping
in Ableton, the per-knob sensitivity slider, and telling the panel your
computer's address so it reconnects itself after a reboot — is
[`docs/midi-ableton.md`](docs/midi-ableton.md).

This is the missing half of [`docs/director-midi.md`](docs/director-midi.md):
the Director's `.mid` export writes CC 20–23, so drop the clip on a MIDI
track, set the track's output to the panel's port, and the show plays on the
panel from Live's transport. The switch on the console's **MIDI** page turns it
off without reflashing; `/api/status` reports the session,
sensitivity and message counts under `midi`.

## OSC — Ableton today, anything tomorrow

The edition also speaks **OSC** — plain OSC 1.0 over UDP, both directions.
The ready-made client is the **Max for Live bridge** in
[`integrations/ableton/`](integrations/ableton/): load it in Ableton and
your set and the panel talk to each other.

But the bridge is just one client of a written contract,
[`docs/osc-spec.md`](docs/osc-spec.md) — anything that can send a UDP OSC
message can drive the panel the same way. TouchDesigner, VCV Rack and
Processing speak it natively; Blender does through an OSC add-on or a few
lines of Python. Send `/patternflow/ping` once and the device learns your
address and starts streaming the other way too — encoder turns and button
presses arrive as OSC events, so the panel's knobs can drive *your* software
just as well. Build against the spec, not the firmware source; that's what
it's for.

## When several sources are live

A hand on an encoder beats everything. The extension/app stream beats the
microphone on any lane it's driving. The mic takes whatever's left. So you
can leave the mic on and still grab a knob whenever you want — it comes back
to the music a few seconds after you let go.

A value set from the console's knob sliders, by MIDI CC 20–23 or by
`POST /api/params` outranks all of them: that knob stays where it was put, and
sound does not move it, until that encoder is turned. The Audio page's line
does not show this.

The extension keeps driving its knobs through a silent or paused tab, so with
both on, the microphone does not take over during a pause. Press **Stop** in
the extension to give the knobs to the room, or **Mute** a knob in the
extension's editor to give the microphone just that one. The phone app does
not hold yet: half a second into a pause its knobs go back to the encoders,
or to the microphone if that is on.

One thing to know: the **extension keeps its mapping in the browser**, while
the **mic and the phone app share the config stored on the panel**. Same
editor everywhere, two homes for the settings. The top of the console's Audio
page says which source has the knobs right now.

---

## For the AI agent

The hard rules — the same ones humans follow — are in [`AGENTS.md`](AGENTS.md#hard-rules-do-not-violate); the contributor flow is [`CONTRIBUTING.md`](CONTRIBUTING.md).

You were pointed here to work on Patternflow's audio path. The map:

**Firmware — the mapping engine and mic**
([`firmware/patternflow/features/audio_in/`](firmware/patternflow/features/audio_in/)):

| file | role |
| --- | --- |
| `feature_audio_in.h` | Descriptor, the sampling/analysis task, where levels enter the knob pipeline. |
| `core_audio_pdm.h` | PDM mic driver (GPIO 43/44). Its header comment is the authoritative wiring + driver-choice record. |
| `core_audio_fft.h` | FFT and spectrum buckets. |
| `core_audio_in_map.h` | Bands, curve LUTs (33-point, interpolate-only), attack/damping glide, auto-range, the defaults a reset restores, NVS persistence. Manual mode maps linearly in amplitude between a band's two edges; the page's dB axis is a conversion at the page's edge. |
| `core_audio_in_http.h` | `/audio-in` (editor page), `GET /api/audio-in` (the configuration, read once), `POST /api/audio-in` (any subset: a request changes only the fields it carries), `POST /api/audio-in/reset` (everything, or one band with `band=N`), the `?levels=1` live poll, and the frame endpoint the phone posts spectra to. The contract is [`docs/rest-api.md`](docs/rest-api.md#microphone-audio-edition); the phone app is a second client of it, so fields are added, never renamed. |
| `audio_in_index.h` | **Generated** — never edit (chain below). |

**Firmware — MIDI** ([`firmware/patternflow/features/midi/`](firmware/patternflow/features/midi/)):
`core_midi.h` is the mapping (transport-agnostic: handlers in, a sink out),
`core_midi_rtp.h` the RTP-MIDI listener on UDP 5004/5005 over lathoub's
AppleMIDI library. Contract: [`docs/midi-spec.md`](docs/midi-spec.md).
`tools/rtpmidi-probe/` exercises the whole map from a PC with no MIDI driver.

**Firmware — the stream path**
([`firmware/patternflow/features/audio/`](firmware/patternflow/features/audio/)):
`core_audio_ws.h` is a WebSocket server on port 81. The wire contract is
[`docs/audio-ws-spec.md`](docs/audio-ws-spec.md) — clients build against the
spec, not the source. Probe `GET /api/status` for `"audio"` in `caps`. A lane
is released 500 ms after the last message that set it, so a sender that means
to hold a value resends it; the spec says which senders in this tree do.
`feature_audio.h` has the Audio-React switch and its two routes
(`GET`/`POST /api/audio`).

**The editor is authored once and assembled for the panel.** The panel's
`/audio-in` page is the extension's editor inside the panel's own frame, and
one command builds it; CI (`console-sync.yml`) fails when the generated files
are not what the sources assemble to, or the page is over its size budget:

```
tools/patternflow-audio-extension/
  editor.html                  the editor's body (between its EDITOR BODY lines)
  editor.css, mapping.js       down to their EXTENSION ONLY line
  editor.js                    all of it
firmware/patternflow/console/
  _audio_in_bar.html           the page around the editor: heading, Sources, footer
  _audio_in.css                the console's look
  _audio_in_adapter.js         window.PFAdapter over /api/audio-in
      ↓  python firmware/toolchain/console_pages.py build
firmware/patternflow/console/audio-in.html                  generated
firmware/patternflow/features/audio_in/audio_in_index.h     generated
```

Preview without building: `python firmware/toolchain/console_serve.py`
assembles `/audio-in` from those sources on every request and answers its API
the way the firmware does; `/mock?audio=music`, `silence`, `off`, `fresh`,
`nomic`, `stalled`, `phone`, `ext` and `noread` pick what the panel hears
([`console/README.md`](firmware/patternflow/console/README.md#the-page-that-is-assembled-audio-in)).
The page has a budget, `BUDGET` in `build_audio_in_page.py`: 17,500 bytes
gzipped as the panel sends it. It is the heaviest page in the console and
every byte crosses the panel's Wi-Fi, so whole-line comments and indentation
are dropped as it is assembled and what only the extension needs stays below
the `EXTENSION ONLY` lines.

The seam between the editor and whatever feeds it is `window.PFAdapter`. The
contract is the comment at the top of `editor.js`: the source owns its
limits, its level axis, its defaults and where a level sits in a window, and
the editor draws what it is told. The page's adapter follows the console's
rules for a one-connection server (`console/README.md`, "Writing a page"):
every request rides `PF.poll`/`PF.status`, nothing is saved until the
panel's mapping has been read, and a save sends only the fields that changed.

**Chrome extension**
([`tools/patternflow-audio-extension/`](tools/patternflow-audio-extension/)):
`mapping.js` is the mapping model, one object (`PFMap`): defaults, the
curves, level → knob. `editor.js` is the single shared editor module, and
`editor-adapter.js` is its extension adapter (chrome storage, the capture's
frames), the editor's source bar, and a synthetic demo source when the page
is opened outside the extension. `offscreen.js` holds the capture: FFT →
`PFMap` → glide → WS send, the resend that holds a steady value, and the
state every page prints (`phase`). `popup.*` is the capture console and owns
the panel's address; `background.js` relays between the pages and the
offscreen document. The mapping lives in `chrome.storage`
(`patternflowAudioConfig`; the address under `patternflowAudioHost`), not on
the panel. The extension keeps its cream skin; only the panel's page wears
the console's.

**Android app**
([`tools/patternflow-audio-android/`](tools/patternflow-audio-android/)):
`Analyzer.kt` mirrors the extension's analysis and mapping (`offscreen.js`
and `mapping.js`); `DeviceLink.kt` speaks the WS
contract + syncs panel config over `/api/audio-in` + posts monitor frames;
`CaptureService.kt` is the playback-capture foreground service;
`EditorActivity.kt` is a WebView onto the panel's `/audio-in`. Build recipe
in its README. Three things it carries by hand and that a change elsewhere
can leave behind: it sends lanes only when they change, so it does not hold a
steady value (the spec has the fix); it has its own copy of the three bezier
presets, by the names the page stores (`p:smooth`, `p:sharp`, `p:fall`); and
its WebView is set up without the part that shows a `window.confirm` dialog,
which is why the page's Reset mapping is a button pressed twice. Open the
app's editor once before releasing a change to `/audio-in`.

Rules of the road: firmware changes follow [FEATURE_GUIDE.md](FEATURE_GUIDE.md)
(hooks, checkers, `build.sh all`); protocol changes update the spec in the
same PR; API changes extend [`docs/rest-api.md`](docs/rest-api.md) and never
rename what is there; editor changes run `console_pages.py build` so the
panel's page follows — the editor's body is one file for both surfaces, which
is the point.
