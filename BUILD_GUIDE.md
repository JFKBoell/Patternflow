# Patternflow v3 -- Build Guide

> **Building a v2.x board?** Use the [v2 build guide](BUILD_GUIDE_v2.md) instead — v2 and v3 parts are **not** interchangeable.

This guide walks you through building a Patternflow on the v3 board from scratch. v3.9 is the current revision; a v3.0 board follows the same steps (its USB-C footprint stays unpopulated, see §2). No prior soldering experience needed — every joint is big, forgiving through-hole, and the board was deliberately kept that simple so a first-time solderer can finish it.

> 🧭 **The same build, in 3D.** [patternflow.work/guide/build](https://patternflow.work/guide/build) walks through this guide step by step on a 3D Patternflow: the parts list, the soldering order with each part going into its real holes, the case, the wiring, first light. This document stays the written reference; follow whichever suits you, or both.

**Estimated build time:** about 1 hour of hands-on work (~30 min soldering + ~30 min assembly), plus ~10 hours of 3D printing. Parts shipping typically takes ~2 weeks — order first, build later.

**What's new in v3** (vs. v2.x):

- **Simple screw-terminal power** — strip a USB cable, screw two wires in, done. It is the board's only power input (see Section 2).
- **No SMD passives** — every part you solder is through-hole
- **Snap-fit enclosure** — the back panel clicks shut, wall-mount holes are built in, and the LED matrix needs no bump trimming
- Smaller board. **v2.x boards do not fit v3 cases, and vice versa.**

## Table of Contents

1. [Bill of Materials](#1-bill-of-materials-bom)
2. [Power Input — Use the Screw Terminal](#2-power-input--use-the-screw-terminal)
3. [Order the PCB](#3-order-the-pcb)
4. [3D Printing](#4-3d-printing)
5. [PCB Assembly](#5-pcb-assembly)
6. [Case Assembly](#6-case-assembly)
7. [Wiring](#7-wiring)
8. [Firmware](#8-firmware)
9. [Final Checks](#9-final-checks)
10. [Known Issues & Design Notes](#10-known-issues--design-notes)

---

## 1. Bill of Materials (BOM)

The authoritative parts list is [`hardware/bom/bom_v3.9.csv`](hardware/bom/bom_v3.9.csv) — every part specified by manufacturer part number. Read the [BOM README](hardware/bom/README.md) for sourcing notes before ordering. (Holding a v3.0 board? Use [`bom_v3.0.csv`](hardware/bom/bom_v3.0.csv) and see the note in Section 2.)

Budget **US$100–200**. The lower end is the well-sourced build where nothing goes wrong: 3D printing filament ~$30, LED matrix panel ~$20, ESP32-S3 ~$13, PCB + remaining parts (encoders, connectors, etc.) ~$35. Shipping, minimum order quantities on the small parts, and a reprint or two are what take it up from there — so treat ~$100 as the floor rather than the estimate.

### On the board

| Ref | Qty | Part | Spec | MPN (Manufacturer) | Notes |
| --- | --- | --- | --- | --- | --- |
| U1 | 1 | ESP32-S3 DevKit | N16R8, 44-pin, 25.4mm row spacing | ESP32-S3-DevKitC-1-N16R8 (Espressif) | AliExpress modules are usually fine too (see the GPIO0 note, §5). Plugs into sockets — never soldered. |
| — | 2 | Female pin socket | 1×22, 2.54mm | PPPC221LFBN-RC (Sullins) | Soldered into the U1 rows; the DevKit rides on top. |
| SW1–SW4 | 4 | Rotary encoder w/ switch | EC11, 5-pin, 20mm shaft | PEC11R-4220F-S0024 (Bourns) | Insert from the **back** of the board. Cheap EC11 packs work but fail more often. |
| J1 | 1 | Box header | 2×8, 2.54mm, vertical | 61201621621 (Würth) | HUB75 ribbon from the panel plugs in here. Match silkscreen orientation. |
| J3 | 1 | Screw terminal | 2-pin, 5.0mm | TB002-500-02BE (CUI Devices) | +5V out to the panel. Every build needs it. |
| J4 | 1 | Screw terminal | 2-pin, 5.0mm | TB002-500-02BE (CUI Devices) | **Power input** (back of board). Required on every build. |
| C11 | 1 | Electrolytic cap | 1000µF 16V, radial D10×L13 | 16PX1000MEFC10X12.5 (Rubycon) | **Observe polarity.** |

### Off the board

| Qty | Part | Notes |
| --- | --- | --- |
| 1 | LED matrix panel — HUB75, 128×64, P2.5, 320×160mm | **Recommended: [Full color 320×160mm P2.5 HUB75 — AliExpress](https://s.click.aliexpress.com/e/_c3SVdcQr)** (affiliate link — supports Patternflow at no extra cost). Its mounting-screw positions are the verified match for the case, and it ships with the ribbon + power cable you'll use. Other panels can work, but **the driver IC decides** — read [LED Panel Compatibility](docs/panel-compatibility.md) and the sourcing rules below **before** buying one. |
| 6–12 | M4 screw, ~10mm | Panel mounting — **sized for the linked panel.** All 12 holes is the exact fit; 6 spread across the corners and middle holds it firmly. Using a different panel? Buy whatever screws *its* mounting holes take (and see the `for_other_panels/` case note in Section 4). |
| 1 | Sacrificial USB cable (it gets cut) | Power feed into `J4` |
| 1 | USB power bank, 5V | Must fit the case compartment |

Key sourcing rules (details in the BOM README):

- **LED matrix panel: the linked listing is the verified, zero-surprises path** — the case is dimensioned around that exact panel. You're free to buy a different one, but **check two things first**: ① the **driver IC** must be one the firmware can drive. The list of chips that work and the ones that stay completely dark, the review keywords to look for, a copy-paste question for the seller and a prompt for handing the listing to an AI assistant are all in **[LED Panel Compatibility](docs/panel-compatibility.md)** — read it before ordering, because the IC is almost never printed in the listing and *"HUB75E" is not a compatibility promise*. ② Compare its mounting-screw positions against the case — if they differ, print the adjustable-mount version (Section 4) or **adapt the enclosure yourself** from the Blender source (`hardware/case/source/`). Verify before you buy, not after.
- **ESP32-S3**: Espressif is the reference part, but AliExpress modules are usually fine — if yours hits the cold-boot issue, one 10k resistor fixes it ([#16](https://github.com/engmung/Patternflow/issues/16)).
- **Encoders**: any 5-pin EC11 with a push switch works — the cheapest packs just fail more often. Reference part: Bourns PEC11R-4220F-S0024 (20mm shaft — print the matching knob file).

### What you also need (not in BOM)

- 3D printer (256 mm bed is enough — see Section 4)
- White and black PLA filament
- Soldering iron, solder, flux, tweezers
- Wire cutters, Phillips screwdriver, small flathead (screw terminals)
- CA glue (bonding the printed halves — Section 4)
- Putty or baking soda + CA glue (optional seam filling, Section 4)

## 2. Power Input — Use the Screw Terminal

**Power the board through `J4`, the 2-pin screw terminal on the back.** Strip a USB cable, clamp the two wires in, done. That's the whole procedure — and on a v3.9 board it's the only one, because the board carries no other power connector.

> 📦 **Holding a v3.0 board?** It has a USB-C receptacle footprint (`USB1`) and two CC pull-downs (`R1`, `R2`). **Leave all three unpopulated** and power through `J4` exactly as described here — don't buy those parts.
>
> **What happened** ([#221](https://github.com/engmung/Patternflow/issues/221)): a board powered through USB-C ran **completely fine for 20–30+ minutes** — no heat, no symptoms — and then suddenly started **smoking at one of the connector pins**, rapidly frying the receptacle and the power path around it. Whether that was a hand-soldering defect on those tight-pitch pins or a structural limit of the 14-pin THT part under the LED matrix's peak current was never settled — so rather than ship an input nobody should populate, **v3.9 removed the footprint entirely.**
>
> ⚠️ **This is why "it seems to work" proves nothing here.** The failure is *delayed* — running fine for half an hour does not mean the joint is safe.
>
> The screw terminal has none of this history — it's the original, proven Patternflow power input, and it's exactly as capable.

| | **`J4` — screw terminal** |
|---|---|
| Populate | `J4` (2-pin screw terminal, back of board) |
| Power cable | Any USB cable, stripped, wires screwed in (see Section 7) |
| Difficulty | Easy — a screwdriver, no soldering iron |

<img src="docs/build-guide/images/v3/16_power_path_compare.jpg" width="85%">

***Build the board on the left.*** `J4` carries the screw terminal. On the right is a v3.0 board with the USB-C receptacle and its CC pull-downs populated (circled) — **that configuration is retired**, and v3.9 has no footprint for it.

## 3. Order the PCB

The easiest way is the **PCBWay shared project** — no Gerber upload needed, and ordering through it supports Patternflow development:

<a href="https://www.pcbway.com/project/shareproject/Patternflow_An_LED_synthesizer_776d796c.html"><img src="https://www.pcbway.com/project/img/images/frompcbway-1220.png" alt="PCB from PCBWay" /></a>

Any fab works, though — upload **`hardware/pcb/gerber/patternflow_v3.9_gerber.zip`** to the fab of your choice (JLCPCB tends to be the cheapest), or start from the KiCad source in `hardware/pcb/kicad/`.

> ⚠️ **v3.x only.** Do not order v2.1 for this guide — the v2.1 board is a different size and **will not fit the v3 cases**. Anything in `hardware/pcb/gerber/experiment/` is unverified; don't order it either.

## 4. 3D Printing

> **No 3D printer?** The case can be laser-cut instead: [Simone Majocchi's laser-cut case](hardware/case/remixes/simonepda-lasercut/README.md) is a community remix cut from acrylic or MDF sheet. Its README takes the place of this section and Section 6; the rest of this guide is the same.

> **Another printed case:** [Besoiobiy's printed case](hardware/case/remixes/besoiobiy-printed/README.md) is a community remix in glued halves with screwed-on covers, the panel bolted through the case into its own M3 sockets. Check your panel against its README first. The README takes the place of this section and Section 6, and gives the order for Sections 7 to 9, because the panel is wired before its covers go on.

**Bambu / MakerWorld users — this section is one click:** the case lives on **[MakerWorld](https://makerworld.com/ko/models/3072492-patternflow-open-source-led-synthesizer-case#profileId-3459015)** with tuned print profiles (the same 4-plate project is in the repo as [`hardware/case/bed_256mm/patternflow_v3.3mf`](hardware/case/bed_256mm/patternflow_v3.3mf)). Slicing manually instead? Case folders are named by **printer bed size** — see [`hardware/case/`](hardware/case/):

| Your printer bed | Print | Notes |
|---|---|---|
| **256 mm** (P1S / X1C / A1 class) | `bed_256mm/encloser.stl` | Body frame (the LED panel's mounting tabs are part of it), back panels and covers in one STL. **White PLA.** ~10 h total. |
| **~330 mm+** (H2S class) | `bed_330mm/encloser.stl` | The one-piece original — body (panel-mounting tabs built in) and closing part in one STL, **no bonding at all**. **White PLA.** Adds a USB pass-through to the DevKit and a cable exit slot — **for wired MIDI/OSC and flashing, not for power** (power is always `J4`, Section 2). |
| **Everyone** | `knobs/knobs_20mm.stl` | **Required for every build** — all four knobs in one plate, as its own separate print job. **Black PLA.** (15 mm-shaft encoders → `knobs_15mm.stl`.) |

Two colors, on purpose: **body in white, knobs in black** — that contrast is the Patternflow look. Printing the knob plate as a separate job keeps it simple (no color changes mid-print).

> **Using a different LED panel than the BOM link?** Panel suppliers drill mounting holes in different places. Print `bed_256mm/for_other_panels/divided_v3_part1..5.stl` instead — its LED-mount part adjusts to varying bolt-hole positions ([#169](https://github.com/engmung/Patternflow/issues/169)-verified). Even so, check the mount against your panel before committing: a very different hole layout may still not fit.

### Print settings

- Nozzle 0.4 mm, layer height 0.2 mm, standard supports (not tree), brim off, aux fan ~20% (Bambu P1S default profile works as-is)

<img src="docs/build-guide/images/v3/01_printing.jpg" width="38%"> <img src="docs/build-guide/images/v3/02_printed_parts.jpg" width="58%">

*Left: `encloser.stl` on a P1S bed. Right: everything that comes out of the one print — the body frame with its panel-mounting tabs, the back panels and the covers.*

### Bond the printed halves — right after printing

The 256 mm print splits the **enclosure frame** and the **back panel** into upper and lower halves. As soon as the parts are off the bed, glue each pair together with CA glue — masking tape holds them while curing (left). Backlit (right), a bonded seam shows a hairline gap — that's normal, and putty or baking soda + CA glue fills it:

<img src="docs/build-guide/images/v3/03_glue_mount.jpg" width="42%"> <img src="docs/build-guide/images/v3/04_seam_gap.jpg" width="42%">

**Let the glue cure while you solder the PCB (Section 5).** By the time the board is done, the enclosure is ready.

## 5. PCB Assembly

### ▶️ Video: the entire soldering process, start to finish

The whole PCB assembly is covered in **one YouTube video** — soldering order included, so there's no separate step list here. Click to watch:

[![▶ YouTube — Patternflow v3.0 PCB soldering, full walkthrough](https://img.youtube.com/vi/NZCjMBCsDAc/maxresdefault.jpg)](https://youtu.be/NZCjMBCsDAc)

**[▶ Watch on YouTube — Patternflow v3.0 PCB soldering walkthrough](https://youtu.be/NZCjMBCsDAc)**

All parts are through-hole, and the video covers the complete order.

> 📦 **The video was filmed on a v3.0 board — skip the USB-C segment.** It shows `USB1` being soldered (11:00–15:18); **v3.9 has no USB-C footprint at all**, so that step simply doesn't exist on your board. Everything else applies exactly as shown. (Holding a v3.0 board? Leave `USB1`, `R1`, and `R2` unpopulated — Section 2.)
>
> And these photos are why that input is gone — the pitch is tight enough that a bridge is easy to make and hard to spot ([#221](https://github.com/engmung/Patternflow/issues/221)):
>
> | ❌ A bridge like this shorts +5 V to ground | ✅ What a clean joint looks like |
> |---|---|
> | <img src="docs/build-guide/images/v3/06_usbc_bad.jpg" width="100%"> | <img src="docs/build-guide/images/v3/07_usbc_good.jpg" width="100%"> |

<details>
<summary><b>ESP32 pin reference</b> — the full 44-pin map. You don't need it for a normal build; it's here for debugging and derivative designs.</summary>

Extracted from the v3.0 netlist (identical functions to v2.x — the same firmware runs on both):

| # | Pin | Function | | # | Pin | Function |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 3V3 | +3.3V supply | | 23 | GND | GND |
| 2 | 3V3 | NC | | 24 | TX | NC |
| 3 | RST | NC | | 25 | RX | NC |
| 4 | IO4 | ENC1_A | | 26 | IO1 | ENC4_SW |
| 5 | IO5 | ENC2_A | | 27 | IO2 | HUB_CLK |
| 6 | IO6 | ENC3_A | | 28 | IO42 | HUB_R1 |
| 7 | IO7 | ENC4_A | | 29 | IO41 | HUB_G1 |
| 8 | IO15 | ENC2_SW | | 30 | IO40 | HUB_B1 |
| 9 | IO16 | ENC3_B | | 31 | IO39 | HUB_G2 |
| 10 | IO17 | ENC3_SW | | 32 | IO38 | HUB_R2 |
| 11 | IO18 | ENC4_B | | 33 | IO37 | NC (PSRAM internal) |
| 12 | IO8 | ENC1_B | | 34 | IO36 | NC (PSRAM internal) |
| 13 | IO3 | NC | | 35 | IO35 | NC (PSRAM internal) |
| 14 | IO46 | HUB_A | | 36 | IO0 | NC — boot strap (see note) |
| 15 | IO9 | ENC1_SW | | 37 | IO45 | NC |
| 16 | IO10 | ENC2_B | | 38 | IO48 | HUB_C |
| 17 | IO11 | HUB_B | | 39 | IO47 | HUB_LAT |
| 18 | IO12 | HUB_D | | 40 | IO21 | HUB_E |
| 19 | IO13 | HUB_B2 | | 41 | IO20 | NC |
| 20 | IO14 | HUB_OE | | 42 | IO19 | NC |
| 21 | 5V | +5V input | | 43 | GND | GND |
| 22 | GND | GND | | 44 | GND | GND |

</details>

> **GPIO0 / cold-boot note.** The v3.0 board leaves GPIO0 unconnected (no pullup pad). Most modules boot reliably that way, but some show cold-boot lockups from the floating strap pin ([#16](https://github.com/engmung/Patternflow/issues/16)). If yours consistently needs a RESET press after power-on, apply the on-module 10k GPIO0→3.3V fix photographed in that issue — one resistor and it's solved.

## 6. Case Assembly

### ▶️ Video: from printed parts to first power-on

Sections 6, 7, and 9 are covered in **one YouTube video** — the full assembly, wiring, and first boot. Click to watch:

[![▶ YouTube — Patternflow v3.0 enclosure assembly & first power-on](https://img.youtube.com/vi/J9C9bZgkNKs/maxresdefault.jpg)](https://youtu.be/J9C9bZgkNKs)

**[▶ Watch on YouTube — Patternflow v3.0 assembly & first power-on](https://youtu.be/J9C9bZgkNKs)**

By now the enclosure halves you bonded in Section 4 have cured and the board is soldered — time to bring them together. The video above walks every step; in writing:

> Printed the **330 mm one-piece body**? Everything in this section is identical — the only thing you skipped is the bonding step in Section 4.

1. **Seat the LED panel in the enclosure from the front, with its `HUB-75E IN` connector toward the top** — that's the side the ribbon reaches `J1` from. ⚠️ The panel insertion is very tight — near-zero clearance. Work it in slowly.

2. **Screw the panel to the frame's mounting tabs from behind.** On the standard print the tabs are part of the frame and line up with the BOM-linked panel's holes. Printed the `for_other_panels/` variant (Section 4)? Its mount is a separate, adjustable piece, because bolt-hole positions vary between suppliers — match it to your panel first, then screw.

3. **Set the board into its bay and secure the encoders from the front**: attach each encoder's nut and tighten with a wrench or pliers — this locks the board against the front face.

### Finishing touches

- The power bank slides into the internal compartment behind the board bay.
- The four black knobs press-fit onto the encoder shafts — save them for **last**, after the Section 9 checks pass.

## 7. Wiring

1. Connect the HUB75 ribbon from `J1` to the panel's `IN` connector.
2. Wire `J3` to the panel's power cable (+5V / GND — double-check polarity). The wiring run is shown at **06:57** in the [assembly video](https://youtu.be/J9C9bZgkNKs).
3. Power: stripped USB cable into `J4` (red = +5V, black = GND).

   **Do it in this order, it's much easier:**

   1. Cut the USB cable and **strip the two power wires** (red = +5 V, black = GND; ignore the data wires).
   2. **Thread the cable through the enclosure's cable hole first** — before it's attached to anything.
   3. **Clamp the stripped wires into `J4`** on the board and tighten the screws. Give each wire a gentle tug to confirm it's held.
   4. *Then* fit the board into the enclosure. Doing it this way means you're never fishing a cable through a hole with the board already in place.

   <img src="docs/build-guide/images/v3/17_screw_terminal_wiring.jpg" width="45%">

   *Cable already through the enclosure hole, wires clamped into `J4`, board about to go in.*
4. **Leave the ESP32 DevKit out of its sockets for now.** It gets its firmware on its own, out of the board (§8.1), and goes in only after that, with the power bank unplugged. The first power-up is §8.1, step 5.

## 8. Firmware

The ESP32-S3 module is flashed **on its own, out of the board**, once; after that, patterns and firmware updates arrive over Wi-Fi. Already seated it? Lift it gently straight up out of the sockets first. **One firmware image serves every board generation** — the pin map is identical on v2.x and v3.0, so there is no board selection to get wrong.

### 8.1 Browser flash (recommended)

No installation required — desktop **Chrome or Edge** only (Web Serial; Firefox/Safari won't work). Steps 1–6 follow the Play guide's [Flash chapter](https://patternflow.work/guide/play#flash) in the same order, and step 7 is its [Patterns chapter](https://patternflow.work/guide/play#patterns).

> 🎬 **See it before you do it.** [patternflow.work/guide/play](https://patternflow.work/guide/play) walks through this section — the port, BOOT and RST, the Wi-Fi step, the Basics pack — on a Patternflow you can turn, and every step has a link for telling us where you got stuck.

> 🔌 **Use the LEFT USB-C port** — the one on your left when the two ports face you. On the ESP32-S3 DevKit that's the board's **native USB** port (labeled `USB`); the browser flasher (Web Serial + Improv) talks to it directly. The right-hand port goes through a separate USB-to-UART bridge chip and is the one Arduino IDE uses (§8.2) — the flasher may still write the firmware through it, but the Wi-Fi step never appears there, because the firmware only listens for it on the left port.

1. **Connect the module on its own.** Hold it antenna up, ports toward you, and connect its **left port** (see above) to your computer with a USB-C **data cable**. A charge-only cable is the usual reason nothing shows up.
2. **Download mode first — every first flash, before you click anything in the browser.** Press and **hold BOOT**, **tap RST** (labelled EN on some modules), then **let go of BOOT**. The module now waits for its firmware.

   In download mode the flasher can't tell the module already runs Patternflow, so it **erases it** — installed patterns and saved Wi-Fi included. Fine on a new build. A board already running Patternflow updates over Wi-Fi instead, from its console's **Update** page, and keeps everything.
3. **Flash.** On **[patternflow.work](https://patternflow.work)**, open the **Pattern** tab, find **Got the hardware?** and click **Flash Patternflow** (the Play guide's Flash chapter has the same button). Pick the line like `USB JTAG/serial debug unit (COM4)` — the number depends on which USB port you used — and install. It takes about two minutes. Not in the list? Hold BOOT, tap RST again, then click the button again.
4. **Wi-Fi — expect it to take a second go.** Usually the install ends without asking for your network. Nothing failed: after download mode the module just hasn't restarted into Patternflow yet. Close the dialog, press **RST** once, click **Flash Patternflow** again and pick the port: this time it opens on Patternflow's own menu instead of installing. Choose **Connect to Wi-Fi**, let the short scan finish (it lists nothing, by design), and type your network's name exactly — it is case-sensitive — and its password. Use a **2.4 GHz** network; the ESP32-S3 cannot see 5 GHz. (Sometimes the same form comes straight after the install instead; fill it in there the same way.) Still won't join? Carry on: step 6 does it from a phone.
5. **Back in, power on.** Unplug the USB cable. With the power bank unplugged, seat the module in the board's sockets the way the silkscreen shows: its USB-C ports toward the board's `USB` mark, all 44 pins in, neither row shifted by one. Then plug the `J4` lead into the power bank — never the module's USB ports (Section 2). Within a second or two the panel lights with **Origin**, a red, squarish pattern.
6. **Still no Wi-Fi? The panel is a network itself.** Give it about 15 seconds after power-on, then hold **K2**, the top-left knob, for a second. `CONNECTED` and an address: it's on your Wi-Fi, carry on. `HOTSPOT` and a name like `patternflow-a1b2`: it found no network it knows, so it raised its own. Join that network from a phone or laptop — the password is `patternflow` — and open `http://192.168.4.1/`. The phone will say the network has no internet; that is true, and it stays connected. On the **Wi-Fi** page, pick your network, add its password and save: the panel shows `JOINED` and its new address, or why it couldn't. Neither on K2 yet? Wait a few seconds and hold it again. Not in your phone's list yet? Refresh it (or switch Wi-Fi off and on), and look for the exact name K2 shows.
7. **Load the patterns.** The image ships with **Origin only** — the rest live on the device's filesystem instead of inside the firmware, which is what freed the memory for everything else. Back on your own Wi-Fi, open **[the decks shelf](https://community.patternflow.work/community/decks)** and press **Install to my board** on the **Basics** pack: 33 patterns, one click, no account. Your browser fetches the pack and hands it to the board over your Wi-Fi, so the board is never talking to the internet itself. On a freshly flashed board the device's page first says **Storage needs formatting**: press **Format storage**, confirm, and the pack installs by itself as soon as the format is done. On Android, `patternflow.local` does not resolve — type the board's IP address (hold **K2**) into the **Device address** field on the Basics card instead.

> 🎛️ **One pattern after flashing is correct, not a failed install.** It used to be 34 baked into the image. They moved out so that patterns can be added and removed without reflashing, which is also how anything you make yourself reaches the panel.

> 🔍 **Still nothing in the port list?** Put the module into download mode again (step 2) and look again. Still nothing? It is almost always the cable — a charge-only USB-C one enumerates nothing at all. **There is no driver to install on this port**: the ESP32-S3 handles USB itself, so the CP2102 / CH34x links on the flasher's troubleshooting screen do not apply here.
>
> Only meant to update a module that already runs Patternflow, over USB? Skip download mode: plugged in as it is (or after a press of **RST** alone), the flasher recognises Patternflow and updates it in place, keeping its patterns and Wi-Fi. The console's **Update** page does the same over Wi-Fi.

> 📶 **Changing Wi-Fi later.** The network you set during flashing is **saved on the device and reused on every boot**. The panel remembers up to five networks — home, studio, a venue — and tries the most recent first, so moving it does not mean reflashing. Add or forget networks on the device's **Wi-Fi** page (the console at `patternflow.local`, or the board's IP address). Somewhere with none of them, it raises its own `patternflow-xxxx` network again, as in step 6 (every image the flasher and the editions page install does; the older clock and MIDI try-out images from the features page don't). The hotspot's mode (`auto`, `always`, `off`) and password are on the same page. A plain Arduino IDE re-upload does **not** clear the stored networks; **Tools → *Erase All Flash Before Sketch Upload*** does.

<img src="docs/build-guide/images/web_flash.jpg" width="33%"> <img src="docs/build-guide/images/esp32_insert.jpg" width="33%">

*Photos from the v2 guide — the flashing flow is identical on v3.*

### 8.2 Arduino IDE (custom builds)

> 🔌 **Use the RIGHT USB-C port** for Arduino IDE — the one on your right when the ports face you, labeled `UART`/`COM`. It's the USB-to-UART bridge Arduino uploads through; the left (native `USB`) port is for the browser flasher (§8.1). If the IDE doesn't see a serial port, you're likely on the wrong one.

- Board settings: *ESP32S3 Dev Module*, PSRAM: *OPI PSRAM*, Flash: *16MB*, USB CDC On Boot: *Enabled* — full setup in [`firmware/README.md`](firmware/README.md). CDC On Boot is what puts the browser flasher's Wi-Fi setup on the left `USB` port; with it disabled that step moves to the other socket.
- Running a panel other than the BOM-linked one? **Try the stock firmware first** — the default `PANEL_PROFILE` (`PANEL_STANDARD`) drives most panels, including the FM6124 in the reference build. Only if the panel comes up **completely dark** do you change it in `config.h` to match your driver IC (`PANEL_HIGHREFRESH`, `PANEL_FM6124`, `PANEL_ICN2038S`, `PANEL_MBI5124`, `PANEL_DP3246`). See [docs/panel-compatibility.md](docs/panel-compatibility.md).
- To wipe stored Wi-Fi credentials, enable **Tools → Erase All Flash Before Sketch Upload** before uploading (see the Wi-Fi note in §8.1).
- **ArduinoOTA** works over Wi-Fi after the first join — functional, but the flasher and wired upload are the primary paths.

### Want OSC / MIDI / Ableton control? Install the Audio edition

OSC, network MIDI and audio-react ship in the **Audio** edition: open [patternflow.work/editions](https://patternflow.work/editions), pick Audio, and it installs from the browser over Wi-Fi with your patterns and settings intact — no rebuild, no secrets file, no cable. The [Ableton bridge](integrations/ableton/) and the [MIDI walk-through](docs/midi-ableton.md) start from there. (Building your own image with a different feature set is [docs/EDITIONS.md](docs/EDITIONS.md).)

## 9. Final Checks

1. Slide the power bank into its compartment and connect it via the `J4` cable.
2. The panel lights up with the default pattern (Origin) within a second or two.
3. Turn all four knobs — each should visibly change the pattern.
4. Press-click each encoder once; long-press **K4** (~1s) to enter pattern select, rotate to browse, long-press again to exit.
5. Long-press **K1** for the global brightness mode; **K2** long-press shows the NETWORK screen (Wi-Fi state and IP address); **K3** long-press puts each knob's number on the panel.
6. Power-cycle once and confirm it boots cleanly with no RESET press needed (see the GPIO0 note in Section 5 if it doesn't).
7. All good? **Close the back panel**: hook the right edge in first, then press along the snap-fit until it clicks shut (shown at **09:11** in the [assembly video](https://youtu.be/J9C9bZgkNKs)). Press the knobs onto the shafts last.

## 10. Known Issues & Design Notes

- **Tight LED panel fit / bonded-seam gaps** — see the Section 4 bonding notes and Section 6 ([#169](https://github.com/engmung/Patternflow/issues/169)).
- **USB-C input removed in v3.9.** A USB-C-powered v3.0 board ran normally for 20–30+ minutes, then smoked at a connector pin and destroyed the receptacle and surrounding power path ([#221](https://github.com/engmung/Patternflow/issues/221)). Whether that was a soldering defect on the tight-pitch THT pins or a structural limit of the part under the matrix's peak current was never settled — so the footprint came off the board instead of shipping an input that must not be populated. **Every build powers through the `J4` screw terminal** (Section 2); on a v3.0 board, leave `USB1`/`R1`/`R2` bare.
- **C11 (1000µF bulk cap) retained** — Patternflow is power-bank-powered; the cap stabilizes the boot transient. Designing a desktop-USB derivative? Drop it to ≤50µF.
- **GPIO0 left floating by design** — most modules don't need the pullup; if yours does, it's a one-resistor fix (Section 5 note, [#16](https://github.com/engmung/Patternflow/issues/16)).
- **Encoder direction is handled in firmware** — the default suits the Bourns PEC11R; if your encoders read backwards, or one click moves two steps, fix it per knob on the device's `/knobs` page — no rebuild; `INVERT_ENCODER` in `config.h` is only the compile-time default.
- **No LED-matrix bump trimming.** The enclosure recesses the panel's two alignment bumps, so the old nipper step ([#19](https://github.com/engmung/Patternflow/issues/19)) is gone. The design also gives you a snap-fit back panel and two wall-mount holes.

---

**Device built? Now fill it.** The **[Pattern Guide](PATTERN_GUIDE.md)** covers everything that comes next — pulling community patterns onto your device over Wi-Fi (a few seconds, no cable), generating your own in Pattern Lab, verifying them on hardware, and sharing them back. The Arduino IDE route above stays for firmware development; see [`firmware/CUSTOM_PATTERNS.md`](firmware/CUSTOM_PATTERNS.md) for the low-level pattern format.

*Licenses: firmware & web MIT; hardware & designs CC-BY-SA 4.0.*
