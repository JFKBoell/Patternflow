# Build Patternflow — Assembly Map

> **Which version am I building?** Current hardware is the **v3.9 board** (the v3.0 board with the USB-C footprint removed; same case, same guide): follow **[BUILD_GUIDE.md](../../BUILD_GUIDE.md)** and take the files from the tree — [`hardware/README.md`](../../hardware/README.md) says exactly which Gerber, BOM and STL to use. The [v3.0.0 release](https://github.com/engmung/Patternflow/releases/tag/v3.0.0) bundles the previous revision's files.
> Own a **v2.x board**? Use **[BUILD_GUIDE_v2.md](../../BUILD_GUIDE_v2.md)** and the **[v2.1.0 release](https://github.com/engmung/Patternflow/releases/tag/v2.1.0)** instead. **v2 and v3 parts are not interchangeable** — the boards do not fit each other's cases.

> 🔦 **Buying the LED panel? Read [LED Panel Compatibility](../panel-compatibility.md) first.** Patternflow scans the panel directly from the ESP32-S3, so the **driver IC** decides whether it lights up — "HUB75E" on the listing does not, and a spec-matching panel with S-PWM "video wall" drivers stays completely dark with no firmware fix. Since that part number is almost never in the listing, the practical check is the **buyer reviews**: someone running it off an ESP32 or Raspberry Pi is the best evidence you'll get.

Patternflow is not a single, rigid kit. It is a modular system divided into two core parts:

1. **Enclosure** — how you house the device (3D printed, or one of the community remixes below).
2. **Electronics** — how you wire the hardware (custom PCB, or breadboard).

Build those two, flash the firmware, and your Patternflow is alive.

## The main route (v3.9 board)

| Enclosure | Electronics | Firmware | Status |
| --- | --- | --- | --- |
| [3D printed enclosure](../../hardware/case/README.md) | [Custom PCB, hand-soldered](../../hardware/pcb/README.md) | [Browser flash](../../BUILD_GUIDE.md#8-firmware) · [your own patterns](../../PATTERN_GUIDE.md) | **Current — fully documented** |

This is the route [BUILD_GUIDE.md](../../BUILD_GUIDE.md) walks start to finish, and the one the [interactive build guide](https://patternflow.work/guide/build) shows in 3D: PLA parts on any 256 mm-bed FDM printer, the hand-soldered v3.9 board (all through-hole — deliberately kept first-timer easy), and firmware flashed from the browser. Two ordering shortcuts are wired straight to it:

- **PCB** — the [PCBWay shared project](https://www.pcbway.com/project/shareproject/Patternflow_An_LED_synthesizer_776d796c.html): no Gerber upload, and ordering there supports Patternflow development.
- **Case** — the [MakerWorld listing](https://makerworld.com/en/models/3072492-patternflow-open-source-led-synthesizer-case#profileId-3459015): tuned one-click print profiles for Bambu printers (STLs in `hardware/case/` for everyone else).

## All combinations

| Enclosure | Electronics | Status |
| --- | --- | --- |
| 3D printed enclosure | Custom PCB | **Current** — [BUILD_GUIDE.md](../../BUILD_GUIDE.md) |
| 3D printed enclosure | Breadboard / jumper-wire electronics | Available — [Breadboard Build Guide](https://patternflow.work/build/breadboard) |
| Laser-cut acrylic or MDF sheet | Custom PCB | Community — [`remixes/simonepda-lasercut/`](../../hardware/case/remixes/simonepda-lasercut/README.md), by Simone Majocchi. Built by its author in both materials; its README stands in for the printing and case-assembly sections of the build guide |
| 3D printed, glued halves with screwed-on covers | Custom PCB | Community — [`remixes/besoiobiy-printed/`](../../hardware/case/remixes/besoiobiy-printed/README.md), by Besoiobiy. Built by its author; the panel is bolted through the case into its own M3 sockets, so check your panel's thread size and socket depth first. Its README stands in for the printing and case-assembly sections of the build guide and sets the wiring order |
| 3D printed, horizontal on a desk, with stands | Custom PCB | Community — [`remixes/mbchars-horizontal-desktop-printed/`](../../hardware/case/remixes/mbchars-horizontal-desktop-printed/README.md), by Mykyta Bilous (mbchars). Built by its author; the panel lies the long way with the controls on the right, and there is no power-bank bay — a separate USB-PD trigger module feeds `J4`, the screw terminal, at 5 V. Its README and assembly notes stand in for the printing and case-assembly sections of the build guide |
| Any other enclosure | either | Not an official path. Community variants live in [`hardware/case/remixes/`](../../hardware/case/remixes/README.md); the old acrylic drawings, for the v1 and v2 boards, are in [`legacy_lasercut/`](../../hardware/case/legacy_lasercut/README.md) |

The breadboard path exists to make Patternflow easier and cheaper to start. A breadboard build is not just a temporary prototype — if that form is enough for you, it is a valid Patternflow build. Want a more finished object later? Move to the PCB and printed-enclosure path whenever you like.

The custom PCB path is stable. PCBA may become a later electronics path for people who want the same PCB with less hand assembly.

## Firmware & custom patterns

To bring the hardware to life you flash it with firmware, and you can **create and run your own generative patterns with AI coding assistants**.

Custom patterns no longer need a local toolchain or a reflash: a pattern built in the browser installs on the panel over Wi-Fi as a `.pfm` module in seconds (the browser flasher writes the firmware over USB once, with the DevKit out of the board and in download mode — hold BOOT, tap RST — and Wi-Fi is set after it, usually on a second go with the flasher or from the panel's own network; the Play guide's [Flash chapter](https://patternflow.work/guide/play#flash) has the order, and [`BUILD_GUIDE.md` §8](../../BUILD_GUIDE.md#8-firmware) the details). The PlatformIO route remains only for firmware feature development or targeting a different LED matrix resolution.

- **[Make your own patterns](../../PATTERN_GUIDE.md)** — the Pattern Lab, the community, and sending a pattern to your device over Wi-Fi. [`firmware/CUSTOM_PATTERNS.md`](../../firmware/CUSTOM_PATTERNS.md) is the hands-on route.

## Guides & releases

| Version | Guide | Everything bundled |
| --- | --- | --- |
| **v3.9 board** (current; v3.0 is the same board with a USB-C footprint you leave empty) | [BUILD_GUIDE.md](../../BUILD_GUIDE.md) | the files in [`hardware/`](../../hardware/README.md); the [v3.0.0 release](https://github.com/engmung/Patternflow/releases/tag/v3.0.0) bundles the v3.0 revision |
| v2.1.0 (legacy) | [BUILD_GUIDE_v2.md](../../BUILD_GUIDE_v2.md) | [v2.1.0 release](https://github.com/engmung/Patternflow/releases/tag/v2.1.0) |
