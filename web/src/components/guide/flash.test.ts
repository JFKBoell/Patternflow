import { describe, expect, it } from "vitest";
import { COPY } from "./copy";
import { SCENES, type Step } from "./scenes";
import { FIRMWARE } from "@/lib/guide/panelScreens";

// Play's 01 Flash, in the order a first flash really goes: download mode
// before the button, every time; the Wi-Fi on the assumption that it does
// not come by itself (RST, then the flasher again); power through the
// Patternflow's own cable; and the panel's own network for when the Wi-Fi
// still won't take.

const langs = ["en", "ko"] as const;
const flash = SCENES.find((s) => s.id === "flash")!.steps as Step[];

describe("Play 01 Flash", () => {
  it("puts download mode before the flasher, and the flasher's button on the Wi-Fi card too", () => {
    for (const lang of langs) {
      expect(COPY[lang].flash.steps.map((s) => s.extra ?? null)).toEqual([null, null, null, "bootSeq", "flashButton", "wifiShots", null, null]);
    }
    expect(flash.findIndex((s) => s.bootSeq)).toBe(3);
    expect(flash.findIndex((s) => s.flashing)).toBe(4);
    // BOOT and RST loop on the stage: the step has room to watch them.
    expect(flash[3].dwell).toBeGreaterThan(1);
    expect(COPY.en.flash.steps[3].title).toBe("Hold BOOT, tap RST, let go.");
  });

  it("still lands the Build guide's way in (#flash-2) on “Hold it like this”", () => {
    expect(COPY.en.flash.steps[1].kicker).toBe("Hold it like this");
    expect(COPY.ko.flash.steps[1].kicker).toBe("이렇게 들어요");
  });

  it("presses RST on the Wi-Fi card, and on no other", () => {
    expect(flash.flatMap((s, i) => (s.rstPulse ? [i] : []))).toEqual([5]);
    expect(flash[5]).toMatchObject({ wifi: "esp", espTags: ["rst"] });
  });

  it("powers on at step 6 — the stage's reassembly keys on it — through the power cable only", () => {
    expect(flash.flatMap((s, i) => (s.power ? [i] : []))).toEqual([6, 7]);
    expect(flash[6]).toMatchObject({ esp: 0 });
    expect(COPY.en.flash.steps[6].title).toBe("Back in. Power on.");
    expect(COPY.ko.flash.steps[6].title).toBe("다시 꽂고, 전원.");
    expect(COPY.en.flash.steps[6].body.join(" ")).toMatch(/never through the ESP32's USB ports/);
    expect(COPY.ko.flash.steps[6].body.join(" ")).toMatch(/USB 포트로 넣지 않아요/);
  });

  it("ends on the panel's own network: powered, K2 held long enough to read the hotspot's name", () => {
    const last = flash[flash.length - 1];
    expect(last).toMatchObject({ power: true, hotspot: true, focus: 1, view: "screenKnobs" });
    expect(flash.filter((s) => s.hotspot)).toHaveLength(1);
    // A long press opens NETWORK; K2 closes it again before its own idle timer would.
    const at = (kind: "press" | "release") => (last.demo ?? []).filter((a) => kind in a).map((a) => a.at);
    const [down, exit] = at("press");
    const [up] = at("release");
    expect(up - down).toBeGreaterThanOrEqual(FIRMWARE.longPressMs);
    expect(exit).toBeLessThan(down + FIRMWARE.longPressMs + FIRMWARE.networkIdleExitMs);
    for (const lang of langs) {
      const words = JSON.stringify(COPY[lang].flash.steps.at(-1));
      for (const fact of ["HOTSPOT", "patternflow-a1b2", "http://192.168.4.1/", "15"]) expect(words).toContain(fact);
    }
  });
});
