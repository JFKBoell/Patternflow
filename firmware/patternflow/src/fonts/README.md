# Matrix fonts (panel OS UI)

From [trip5/Matrix-Fonts](https://github.com/trip5/Matrix-Fonts) (CC-BY).

**Optional — not the fonts the panel uses by default.** The panel's own screens draw with the Adafruit GFX built-in 5×7 (pattern names on SELECT), TomThumb (NETWORK rows, hints, status lines) and Org_01 (banners and titles); `../core_ui_fonts.h` binds those three roles. This pair is kept here for anyone who prefers it — the fonts Simone Majocchi's tree uses — and is switched in from `patternflow_secrets.h` or an edition's `overrides.h`, with the block at the bottom of `../core_ui_fonts.h`.

| File | Role it can take |
|------|-----|
| `MatrixLight8X.h` | SELECT titles, banners (`PF_UI_FONT_SELECT`, `PF_UI_FONT_TITLE`) |
| `MatrixLight6.h` | NETWORK / KNOB MAP / chrome hints (`PF_UI_FONT_CHROME`) |

The `.bdf` sources sit beside the headers. The `toolchain/bdf_to_gfxfont.py` this page used to name for regenerating them is not in this repository, so regenerating a header after editing a `.bdf` needs a BDF → Adafruit GFXfont converter of your own.

ASCII `0x20`–`0x7E` only (overlays run text through `asciiFold`).
