# features/artnet — Art-Net in

The panel as an Art-Net node. Resolume, TouchDesigner, MadMapper or any pixel
mapper sends the 128×64 image as ArtDmx on UDP 6454, and the panel shows it in
place of the running pattern (`replace`) or over it (`overlay`).

Built as the `artnet` composition: `./firmware/bundles/build.sh artnet`.
Not on the shelf; it is a composition the tree keeps buildable.

*Art-Net™ Designed by and Copyright Artistic Licence.* (The specification asks
every implementation to carry this credit in its user guide.)

| file | what it is |
| --- | --- |
| `feature_artnet.h` | the descriptor: which function answers which hook |
| `core_artnet.h` | the receiver: socket, task, packet parser, mapping, triple buffer, ArtPollReply |
| `core_artnet_http.h` | `/artnet` and `/api/artnet` |
| `artnet_index.h` | the page, as a PROGMEM literal |
| `artnet_config.h` | compile-time defaults (`#ifndef`) |
| `preset_artnet.h` | the "Art-Net" pattern: a black frame, the one to stream on (see *Frame rate*) |

No core file is edited. The one change outside this directory and
`firmware/bundles/artnet/` is three lines in `firmware/bundles/build.sh`, so
`build.sh all` builds this composition and scans its image for its marker
(`[ARTNET] /artnet ready`).

## How a frame gets to the panel

```
Wi-Fi ─ lwIP (tcpip, Core 0, prio 18)
          │ UDP mailbox: 6 datagrams
          ▼
     pf-artnet task (Core 0, prio 19) ── writes universes into BACK ──┐
                                                                      │ publish: BACK ⇄ READY (atomic)
     loop() (Core 1) ── pattern draws ── present() ── composeFrame ───┘ take: READY ⇄ FRONT (atomic)
                                                         │
                                                         ▼
                                                   blitRGB888 (gamma, white balance, saturation)
```

- **Three PSRAM buffers of 24,576 B**, allocated in `setup()`, plus one more
  for overlay output and a 16 KB mapping table: 114,688 B of PSRAM in all.
  Internal RAM: the task's 4 KB stack, a 640 B packet buffer and a 239 B reply
  buffer.
- **No copy and no lock in the render path.** In `replace` mode,
  `composeFrame` swaps one byte atomically when a newer frame is waiting and
  returns a pointer. `overlay` makes one pass over the frame (8,192 pixels).
- **The stream holds raw values.** Gamma, white balance and saturation are
  applied by the blit, the same as for a pattern.
- **Why priority 19.** The precompiled lwIP in Arduino core 2.0.17 gives a
  UDP socket a mailbox of six datagrams (`CONFIG_LWIP_UDP_RECVMBOX_SIZE 6`),
  and a frame is a burst of 49. A receive task below lwIP's tcpip task (18)
  only runs after tcpip has emptied its own queue, and by then the mailbox
  has overflowed. Above it, each datagram wakes the task at once. The Wi-Fi
  driver (23) still outranks it.

## When the stream is on the panel (checked in `patternflow.ino`)

`composeFrame` runs inside `PFCanvas::present()`, so the stream is shown only
when something presents. In order:

| state | stream? | why |
| --- | --- | --- |
| a pattern running (RUNNING) | **yes** | the pattern's `draw()` presents every frame |
| a pattern loading on the other core | only if it has a thumbnail | the thumbnail is presented; without one the panel holds its last frame |
| SELECT (K4 pattern browser) | no | the feature stands down when `running` is false, so you see what you are choosing |
| NETWORK, knob map, UPDATE screens | no | drawn straight to the panel, no `present()` |
| brightness bar (K1 hold) | yes | the pattern still presents; the bar is drawn over it |
| calibration test card | no | stands down, like the clock |
| no pattern active (the PAUSED card, e.g. during an upload batch) | no | drawn straight to the panel |
| asleep | no | nothing is rendered |

The core was not changed for any of this. What a core change could add is
covered under *Limits*.

## Configuration

The page is at `http://<panel>/artnet`, linked in the console header. Settings
are kept in NVS namespace `artnet`.

| setting | default | |
| --- | --- | --- |
| on | on | also the NETWORK screen: hold K2, the first row is `ARTN`, and turning K2 switches it |
| mode | `replace` | `overlay`: stream pixels whose brightest channel is above *threshold* replace the pattern, darker ones let it through |
| threshold | 8 | overlay only |
| start universe | 0 | the Port-Address (Net·Sub-Net·Universe, 15 bit) of pixel 0. Art-Net 4 calls 0 deprecated; most senders start there anyway |
| pixels / universe | 170 | 16–170. 170 × 3 = 510 of 512 channels |
| channel order | RGB | RGB, RBG, GRB, GBR, BRG, BGR |
| rotation | 0 | quarter turns. 1 = upright (sender image 64 × 128) |
| serpentine, mirror X, mirror Y | off | |
| timeout | 2000 ms | no frame for this long, and the pattern returns |
| frame gap | 20 ms | without ArtSync, a frame still missing universes is shown this long after its first packet |

### Mapping

Stream pixel *p* (0 … 8191) is pixel `p mod ppu` of universe
`start + p div ppu`. In the sender's image, which is 128 × 64, or 64 × 128 at
rotation 1 and 3, pixel 0 is the top-left, and rows run left to right; with
serpentine on, odd rows run right to left. The mirrors flip that image, and
the rotation then turns it onto the panel.

With 170 pixels per universe that is **49 universes** (48 × 170 = 8,160, plus
32 in the last), 0–48 by default. Universes the sender does not fill are
written only as far as their data goes; a universe with fewer pixels than
expected writes the ones it has.

`send_test.py --pattern grid` checks a mapping: red, green, blue and white
corners at (0,0), (127,0), (0,63) and (127,63), a grey grid every 8 px, and
each universe's first pixel lit yellow.

### `/api/artnet`, `/api/status`

`GET /api/artnet` returns the settings and the receiver's state.
`POST /api/artnet` takes any subset of them, form-encoded like every other
route: `on`, `mode=replace|overlay`, `thr`, `uni`, `ppu`, `order`, `serp`,
`rot`, `fx`, `fy`, `timeout`, `gap`, `reset=1`. The header of
`core_artnet_http.h` has the ranges.

`/api/status` gains `"artnet"` in `caps` and an `artnet` block:

| field | |
| --- | --- |
| `on` / `active` / `listening` | switched on / a fresh stream is being shown / socket and task are up |
| `mode` | `replace` or `overlay` |
| `sync` | `true` while ArtSync drives the frames |
| `fps` | frames per second completed by the receiver (published) |
| `shownFps` | frames per second the **panel** took. This is the rate you actually see |
| `pps` | ArtDmx packets per second for this panel's universes |
| `frames` / `incomplete` | published frames, and how many of them were missing universes |
| `skipped` | frames published and replaced before the panel took them (the stream is faster than the panel) |
| `packets` / `ignored` | ArtDmx for our universes / other Art-Net (other universes, other opcodes, ArtSync from a second sender) |
| `polls` | ArtPolls answered |
| `sender` | IP of the last ArtDmx |
| `ageMs` | since the last published frame, `-1` = never |
| `universes`, `stackMin` | expected per frame; the task's stack high-water mark (bytes free) |

## Protocol, as implemented

Checked against *Art-Net 4, Protocol Release V1.4, Document Revision 1.4dp,
23/10/2025* (art-net.org.uk):

- **ArtDmx** (OpCode 0x5000, low byte first): 18-byte header; `SubUni` is
  the low byte of the 15-bit Port-Address and `Net` the top 7 bits; `Length`
  is big-endian, "an even number in the range 2 – 512". The receiver writes
  `min(Length, datagram, 512)` bytes. `Sequence` and `Physical` are not used:
  re-ordering is rare on a LAN, and there is no merging (below).
- **ArtSync** (0x5200): received, the node is in synchronous mode: ArtDmx is
  held until the next ArtSync, which shows the frame. An ArtSync whose source
  IP differs from the latest ArtDmx is ignored, as the specification requires.
  "A node shall time out to non-synchronous operation if an ArtSync is not
  received for 4 seconds or more" → `PF_ARTNET_SYNC_TIMEOUT_MS 4000`.
- **Without ArtSync**, a frame is shown when every universe has arrived, when
  a universe arrives that the open frame already has (the next frame has
  started), or after the frame gap.
- **ArtPoll** (0x2000) → **ArtPollReply** (0x2100), 239 bytes, unicast to the
  poller after a random delay of 0–500 ms (the specification says "up to 1s";
  half keeps device lists responsive). Art-Net 4 does not allow broadcasting
  it. One reply per universe, each with `BindIndex` 1…49, one output port
  (`PortTypes[0] = 0x80`), and its universe in `NetSwitch`/`SubSwitch`/
  `SwOut[0]`. That is how Art-Net 4 describes a node with more than four
  ports. Short name `Patternflow`, long name `Patternflow <hostname> 128x64`.
  Targeted mode is not implemented: every poll is answered.
- **OEM code** `0x00FF` and ESTA code 0. The specification asks implementers
  to register an OEM code with Artistic Licence; this project has not, and
  `PF_ARTNET_OEM` is where a registered one would go.
- **Several senders on one universe are not merged.** Packets are written as
  they arrive, so the latest wins per universe. The specification allows
  merging or treating this as an error, and asks for the choice to be
  documented. This is that documentation.
- Unicast and broadcast are both received.

## Setting up a sender

> **Unverified:** the menu paths below are written from memory, not
> checked against current versions. Treat them as directions. Check the
> result with the grid pattern and `/api/status`.

**Any sender:** unicast to the panel's IP, 49 universes from 0, 170 pixels
per universe, RGB, and ArtSync on if the software has it. Most pixel mappers
call this a 128 × 64 matrix fixture, "RGB, 170 px per universe" or "pixel
strip, 510 channels".

**Resolume Arena** (Advanced Output → Lumiverses / DMX output): create a
Lumiverse per 170 pixels, or let the pixel-mapping fixture generator lay out
a 128 × 64 RGB matrix across consecutive universes. Target the panel's IP
(not broadcast) and map the output to the composition. Resolume can send
ArtSync. If the panel reports `"sync": true`, it is being used.

**TouchDesigner**: a TOP at 128 × 64 → *TOP to CHOP* (RGB, row by row) →
*Shuffle CHOP* into one channel per DMX slot → *DMX Out CHOP* with interface
*Art-Net*, the panel's IP as destination, and one DMX Out per universe (or
the per-universe channel naming the operator's documentation describes).
TouchDesigner's image origin is bottom-left, so the image arrives upside
down unless the TOP is flipped first; *mirror Y* on `/artnet` does the same.

## Measuring

You need the panel's address, `curl`, and ideally `jq`. Start the edition on
the **Art-Net** pattern (K4), so the pattern itself costs nothing.

```bash
P=192.168.1.50                       # the panel
S="python tools/artnet-sender/send_test.py $P"

# 1. A clean window: reset the render-loop timing and the Art-Net counters.
curl -s "http://$P/api/status?resetTiming=1" > /dev/null
curl -s -X POST "http://$P/api/artnet" -d reset=1 > /dev/null

# 2. Send for 60 s at one rate (repeat for 10, 15 and 30; with and without --no-sync).
$S --pattern bar --fps 30 --seconds 60

# 3. Read it back - while the sender runs for rates, after it for totals.
curl -s "http://$P/api/status" | jq '{artnet, loopAgeMs, runtime, frameUs, presentUs}'
```

What to read:

- **Rate on the panel:** `artnet.shownFps`. `artnet.fps` is what the
  receiver completed; when `shownFps` < `fps`, the loop is the limit and
  `skipped` grows. When `fps` < the sender's rate, the network or the
  receiver is the limit.
- **Loss:** `incomplete / frames` is the share of frames missing at least one
  universe. Expected packets are `49 × fps × seconds`; compare that with
  `packets`. Without ArtSync, missing universes keep the previous frame's
  pixels, so a lost packet appears as a stripe of the old frame. With
  `--pattern bar` it shows as a kink in the bar.
- **Does the render loop suffer:** `runtime.maxUs` (the longest loop since the
  reset) and `runtime.over50ms` with the stream against without it, and
  `loopAgeMs` (a few ms on a healthy panel). Also `frameUs` / `presentUs`:
  `overlay` adds its one pass to `presentUs`.
- **Tearing:** `--pattern bar` should show a straight bar in every mode; a
  kinked bar *with* `incomplete` growing is loss, not tearing.
- **With and without ArtSync:** run each rate twice, `--no-sync` the second
  time. If `sync` never reads `true`, the access point may be dropping the
  broadcast ArtSync; `--sync-unicast` sends it to the panel directly.
- **Packet loss on the way, not on the panel:** `--drop 0.02` drops 2 % of
  packets at the sender, to see what a given `incomplete` share looks like.

Estimates (calculated, not measured): one frame is 49 ArtDmx packets with
24,576 B of pixels, about 26.8 KB on the wire with Art-Net, UDP and IP headers.
At 30 fps that is 1,470 packets/s and about 6.4 Mbit/s (5.9 Mbit/s of pixels
alone). 10–15 fps should be comfortable. Whether 30 fps holds is open, and
these measurements are how to find out. The mailbox limit above is the first
suspect if `incomplete` climbs with the rate.

## Limits

- **The stream moves at the pattern's pace.** `composeFrame` runs once per
  `present()`, so a pattern drawing at 20 fps caps the stream at 20 fps, and
  in `replace` mode the pattern's work is thrown away. Use the **Art-Net**
  pattern to stream. A core change that would lift this, not made here: a
  hook that lets a feature ask the loop to present without running the
  pattern (`bool (*wantsFrame)()` at the tail of `PFFeature`, checked in the
  RUNNING branch before `updateActivePattern`/`drawActivePattern`, which
  would then present a cleared canvas). That is a core edit and belongs to a
  separate decision.
- **SELECT and the device's own screens hide the stream**, by design: see the
  table above.
- **Broadcast over Wi-Fi is unreliable.** Access points send it at a basic
  rate without retries. Send ArtDmx unicast. ArtSync is broadcast by
  definition.
- **Six-datagram mailbox.** If loss grows with the rate even at priority 19,
  the next step is lwIP's raw `udp_recv` callback, which runs in the tcpip
  thread with no mailbox at all. That means more code and a stricter
  threading contract, so it waits for a measurement that calls for it.
- **One Port-Address range, no merging, no Targeted Mode, no ArtAddress**
  (nothing about the node can be programmed over Art-Net; use `/artnet`).
- Settings change on the next packet. A frame half-received under the old
  mapping is dropped.

## Test sender

`tools/artnet-sender/send_test.py` uses the standard library only (Pillow
for `--image` / `--text`). Run it with `--help` for the options: gradient,
bar, grid and solid patterns, an image or scrolling text, `--fps`,
`--universe`, `--ppu`, `--no-sync`, `--sync-unicast`, `--drop`, `--seconds`,
and `--poll`, which sends one ArtPoll and lists the replies. It prints the
rate it actually achieves once a second.
