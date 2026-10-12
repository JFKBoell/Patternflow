# Enclosure remixes

Community-made variants of the Patternflow enclosure: a laser-cut acrylic version, a wooden frame, a wall-mount plate, a case for a different panel. One folder per remix, sent as a pull request. The official cases in `../bed_256mm/`, `../bed_330mm/` and `../knobs/` are not edited by a remix; a remix sits beside them.

Work in progress belongs in [Discord](https://discord.gg/Vr9QtsxeTk) (the hardware channels). A folder here is something that has been built at least once.

## What is here

| Folder | What | Fits | By |
| :--- | :--- | :--- | :--- |
| [`simonepda-lasercut/`](simonepda-lasercut/README.md) | Laser-cut from one sheet, 3 mm acrylic or 2.8 mm MDF; the panel screwed to it from behind, the board under a small finger-jointed box beside it, three cubes for feet | v3 board, 320 × 160 mm panel | Simone Majocchi (SimonePDA) |
| [`besoiobiy-printed/`](besoiobiy-printed/README.md) | Printed in two long pieces glued side by side, a frame round the panel and a box for the board and the power bank, closed by four screwed-on covers; the panel is bolted through the case into its own M3 sockets, so check yours first | v3 board, 320 × 160 mm panel with M3 sockets | Besoiobiy |
| [`mbchars-horizontal-desktop-printed/`](mbchars-horizontal-desktop-printed/README.md) | The panel lying the long way across on two removable stands, controls on the right; three front sections joined by bars on brass inserts, no glue needed. No power-bank bay: a separate USB-PD trigger module in the control section feeds `J4`, the screw terminal, at 5 V | v3 board, 320 × 160 mm panel | Mykyta Bilous (mbchars) |

Each README replaces the build guide's printing and case-assembly sections for that case, and says where its order of steps differs. The [/build](https://patternflow.work/build) page has all three on its case switch.

## What a remix folder contains

```
hardware/case/remixes/<maker>-<variant>/
├── README.md          required — see the fields below
├── *.stl / *.dxf / *.svg / *.step / *.3mf
└── photos/            optional, a couple of JPEGs of the built thing
```

Folder name: your maker name, a dash, a short variant name, all lowercase (`nath-acrylic`, `day-paper-diffuser`).

The [/build](https://patternflow.work/build) page can show a remix beside the official case, in its 3D preview too: [`tools/case-models`](../../../tools/case-models/README.md) makes that model from the folder's own files.

## The README is the license header

STL and DXF files cannot carry an SPDX line, so the README carries the license for the whole folder. Its first lines are these fields, one per line, in this order; the first two are checked by CI on every pull request:

```
Author: <your name or handle>, <link>
License: CC-BY-SA-4.0
Based on: hardware/case/bed_256mm (v3 case, tag v3.0.0)   — or "original design"
Fits: v3.9 / v3.0 board                                    — which PCB it holds
Material: 3 mm acrylic, laser cut, 0.1 mm kerf compensated — or the print settings
Verified: 2026-08-12, photo below                          — a date and a photo, or a pin on the build map
```

Then, in prose: what is different from the official case and why, and anything the next person should know before cutting or printing it. CC BY-SA 4.0 is the default license (the official case is CC BY-SA, so a derivative has to be); an original design may choose CC BY 4.0 instead.

## What does not go here

PCB variants (a `hardware/pcb/remixes/` folder will appear the same way when the first one arrives), patterns (those are published from the Pattern Lab to the Community), and photos of a standard build (those go on the [build map](https://patternflow.work/inside) — see [CONTRIBUTING.md](../../../CONTRIBUTING.md#your-build)).
