import { beforeEach, describe, expect, it } from "vitest";
import { DeviceSim, SIM_HOTSPOT, SIM_IP } from "./deviceSim";
import { drawOverlay, PANEL_H, PANEL_W } from "./panelScreens";

// The Audio guide's part of the simulated board: the Audio edition's two rows
// on the NETWORK screen (hold K2), and the lanes — what sound writes over the
// knobs' values without turning the knobs (docs/audio-ws-spec.md). And Play's
// last card of 01 Flash: the same screen while the panel is its own hotspot.

const FRAME = 1 / 60;

/** Run the board for `ms`, calling `each` before every frame (a source that keeps writing). */
function run(sim: DeviceSim, ms: number, each?: () => void) {
  const frames = Math.round(ms / 1000 / FRAME);
  for (let i = 0; i < frames; i++) {
    each?.();
    sim.tick(FRAME);
  }
}

function values(sim: DeviceSim) {
  return [0, 1, 2, 3].map((i) => sim.knobReadout(i).value);
}

function networkFrame(rows?: { name: string; on: boolean }[]) {
  const out = new Uint8ClampedArray(PANEL_W * PANEL_H * 4);
  drawOverlay(out, { kind: "network", wifi: "CONNECTED", ip: SIM_IP, rows });
  return out;
}

describe("the Audio edition's rows on NETWORK", () => {
  let sim: DeviceSim;

  beforeEach(() => {
    sim = new DeviceSim();
    sim.tick(FRAME);
  });

  it("has none on the core firmware, and the screen is the one Play shows", () => {
    expect(sim.snapshot().rows).toEqual([]);
    sim.setMode("network");
    sim.tick(FRAME);
    expect(Array.from(sim.frame)).toEqual(Array.from(networkFrame()));
  });

  it("draws OSC and AUD, both on, once the edition is on the board", () => {
    sim.setEdition("audio");
    expect(sim.snapshot().rows).toEqual([
      { name: "OSC", on: true },
      { name: "AUD", on: true },
    ]);
    sim.setMode("network");
    sim.tick(FRAME);
    const withRows = networkFrame([
      { name: "OSC", on: true },
      { name: "AUD", on: true },
    ]);
    expect(Array.from(sim.frame)).toEqual(Array.from(withRows));
    expect(Array.from(sim.frame)).not.toEqual(Array.from(networkFrame()));
  });

  it("K3 switches AUD and K2 switches OSC: left off, right on", () => {
    sim.setEdition("audio");
    sim.setMode("network");
    sim.turn(2, -1);
    sim.tick(FRAME);
    expect(sim.snapshot().rows.map((r) => r.on)).toEqual([true, false]);
    expect(Array.from(sim.frame)).toEqual(
      Array.from(
        networkFrame([
          { name: "OSC", on: true },
          { name: "AUD", on: false },
        ]),
      ),
    );
    // Left again: still off. A turn sets the switch, it does not flip it.
    sim.turn(2, -2);
    sim.tick(FRAME);
    expect(sim.snapshot().rows[1].on).toBe(false);
    sim.turn(2, 1);
    sim.tick(FRAME);
    expect(sim.snapshot().rows[1].on).toBe(true);

    sim.turn(1, -1);
    sim.tick(FRAME);
    expect(sim.snapshot().rows.map((r) => r.on)).toEqual([false, true]);
    sim.turn(1, 3);
    sim.tick(FRAME);
    expect(sim.snapshot().rows.map((r) => r.on)).toEqual([true, true]);
    // K2 turned is not K2 clicked: the screen is still open.
    expect(sim.snapshot().mode).toBe("network");
  });

  it("a turn keeps the screen open past its eight seconds, as it does on the board", () => {
    sim.setEdition("audio");
    sim.setMode("network");
    run(sim, 6000);
    sim.turn(2, -1);
    run(sim, 6000);
    expect(sim.snapshot().mode).toBe("network");
    run(sim, 3000);
    expect(sim.snapshot().mode).toBe("run");
  });

  it("only switches them on the NETWORK screen", () => {
    sim.setEdition("audio");
    sim.turn(1, -2);
    sim.turn(2, -2);
    sim.tick(FRAME);
    expect(sim.snapshot().rows.map((r) => r.on)).toEqual([true, true]);
  });

  it("is put back as installed at every step edge, and is gone on a step without the edition", () => {
    sim.setEdition("audio");
    sim.setMode("network");
    sim.turn(1, -1);
    sim.turn(2, -1);
    sim.tick(FRAME);
    expect(sim.snapshot().rows.map((r) => r.on)).toEqual([false, false]);
    // The Director, at the next step's edge.
    sim.setEdition("audio");
    expect(sim.snapshot().rows.map((r) => r.on)).toEqual([true, true]);
    sim.setEdition("core");
    expect(sim.snapshot().rows).toEqual([]);
    sim.tick(FRAME);
    expect(Array.from(sim.frame)).toEqual(Array.from(networkFrame()));
    // …and K2 / K3 turned there switch nothing that a later step would find.
    sim.turn(2, -1);
    sim.tick(FRAME);
    sim.setEdition("audio");
    expect(sim.snapshot().rows.map((r) => r.on)).toEqual([true, true]);
  });
});

describe("the hotspot on NETWORK", () => {
  let sim: DeviceSim;

  beforeEach(() => {
    sim = new DeviceSim();
    sim.tick(FRAME);
  });

  it("names the panel's own network where the address would be, as the firmware draws it", () => {
    sim.setHotspot(true);
    sim.setMode("network");
    sim.tick(FRAME);
    const hotspot = new Uint8ClampedArray(PANEL_W * PANEL_H * 4);
    drawOverlay(hotspot, { kind: "network", wifi: "CONNECTING", ip: "-", hotspotName: SIM_HOTSPOT });
    expect(Array.from(sim.frame)).toEqual(Array.from(hotspot));
    expect(Array.from(sim.frame)).not.toEqual(Array.from(networkFrame()));
    expect(SIM_HOTSPOT).toMatch(/^patternflow-[0-9a-f]{4}$/);
  });

  it("is on the network again once the step no longer says otherwise", () => {
    sim.setHotspot(true);
    sim.setMode("network");
    sim.tick(FRAME);
    sim.setHotspot(false);
    sim.tick(FRAME);
    expect(Array.from(sim.frame)).toEqual(Array.from(networkFrame()));
  });

  it("opens on hold K2 and leaves on a press of K2, as on the network", () => {
    sim.setHotspot(true);
    sim.press(1);
    run(sim, 1100);
    sim.release(1);
    sim.tick(FRAME);
    expect(sim.snapshot().mode).toBe("network");
    sim.press(1);
    sim.tick(FRAME);
    sim.release(1);
    sim.tick(FRAME);
    expect(sim.snapshot().mode).toBe("run");
  });
});

describe("the lanes", () => {
  let sim: DeviceSim;
  let home: number[];

  /** The editor, writing all four lanes. */
  const feed = (v: number[]) => () => v.forEach((x, i) => sim.setLane("editor", i, x));

  beforeEach(() => {
    sim = new DeviceSim();
    sim.tick(FRAME);
    // Somewhere the reader left the knobs, not the defaults.
    sim.turn(0, 6);
    sim.turn(1, -3);
    sim.turn(3, 4);
    sim.tick(FRAME);
    home = values(sim);
    sim.setEdition("audio");
    sim.setLaneSource("editor");
    // The turns above were before this step: nobody has the knobs now.
  });

  it("take a knob's value across its range without turning the knob", () => {
    const turns = sim.snapshot().turns;
    run(sim, 200, feed([0.5, 0, 1, 0.25]));
    const snap = sim.snapshot();
    expect(snap.lanes).toEqual([true, true, true, true]);
    expect(snap.laneHeld).toEqual([false, false, false, false]);
    expect(snap.turns).toEqual(turns);
    [0.5, 0, 1, 0.25].forEach((v, i) => {
      const r = sim.knobReadout(i);
      expect(r.value).toBeCloseTo(r.min + v * (r.max - r.min), 9);
    });
  });

  it("reach the pattern: the panel changes with them", () => {
    run(sim, 100, feed([0, 0, 0, 0]));
    const a = Array.from(sim.frame);
    run(sim, 100, feed([0.5, 0, 0, 0]));
    expect(Array.from(sim.frame)).not.toEqual(a);
  });

  it("clamp what they are given and ignore what is not a lane", () => {
    sim.setLane("editor", 0, 7);
    sim.setLane("editor", 1, -2);
    sim.setLane("editor", 2, Number.NaN);
    sim.setLane("editor", 4, 0.5);
    sim.setLane("editor", -1, 0.5);
    sim.tick(FRAME);
    expect(sim.snapshot().lanes).toEqual([true, true, false, false]);
    expect(sim.knobReadout(0).value).toBe(sim.knobReadout(0).max);
    expect(sim.knobReadout(1).value).toBe(sim.knobReadout(1).min);
    expect(sim.knobReadout(2).value).toBe(home[2]);
  });

  it("let go 500 ms after the last write, and the knobs are where they were", () => {
    run(sim, 300, feed([0.9, 0.9, 0.9, 0.9]));
    run(sim, 400);
    expect(sim.snapshot().lanes).toEqual([true, true, true, true]);
    run(sim, 200);
    expect(sim.snapshot().lanes).toEqual([false, false, false, false]);
    expect(values(sim)).toEqual(home);
  });

  it("let go one at a time: a lane that stops being written, while the others carry on", () => {
    run(sim, 200, feed([0.9, 0.9, 0.9, 0.9]));
    run(sim, 700, () => [0, 1, 3].forEach((i) => sim.setLane("editor", i, 0.2)));
    expect(sim.snapshot().lanes).toEqual([true, true, false, true]);
    expect(sim.knobReadout(2).value).toBe(home[2]);
  });

  it("are released at once when the step has none, and Origin's values equal what they were", () => {
    run(sim, 1000, feed([0.1, 0.8, 0.6, 0.3]));
    expect(values(sim)).not.toEqual(home);
    // The Director, at the edge of a step that declares no lanes.
    sim.setLaneSource(null);
    expect(sim.snapshot().lanes).toEqual([false, false, false, false]);
    expect(values(sim)).toEqual(home);
    // A late frame from the window changes nothing.
    feed([1, 1, 1, 1])();
    sim.tick(FRAME);
    expect(values(sim)).toEqual(home);
  });

  it("are not taken before a step opens them, or on the core firmware", () => {
    const fresh = new DeviceSim();
    fresh.tick(FRAME);
    const before = [0, 1, 2, 3].map((i) => fresh.knobReadout(i).value);
    fresh.setLane("editor", 0, 0.7);
    fresh.tick(FRAME);
    expect(fresh.snapshot().lanes).toEqual([false, false, false, false]);
    // Lanes opened, but the board runs the core firmware: nothing listens.
    fresh.setLaneSource("editor");
    fresh.setLane("editor", 0, 0.7);
    fresh.tick(FRAME);
    expect(fresh.snapshot().lanes).toEqual([false, false, false, false]);
    expect([0, 1, 2, 3].map((i) => fresh.knobReadout(i).value)).toEqual(before);
  });

  it("a hand on a knob has it for five seconds; the other three keep following", () => {
    const write = feed([0.5, 0.5, 0.5, 0.5]);
    run(sim, 300, write);
    write();
    sim.turn(0, 2);
    sim.tick(FRAME);
    let snap = sim.snapshot();
    expect(snap.lanes).toEqual([false, true, true, true]);
    expect(snap.laneHeld).toEqual([true, false, false, false]);
    // The hand moved the knob's own value, from where the knob was — not from the lane's.
    const r = sim.knobReadout(0);
    expect(r.value).toBeCloseTo(home[0] + 2 / 48, 6);
    const held = r.value;

    run(sim, 4800, write);
    snap = sim.snapshot();
    expect(snap.lanes[0]).toBe(false);
    expect(sim.knobReadout(0).value).toBe(held);

    // Keep streaming and the lane resumes when the hold expires.
    run(sim, 400, write);
    snap = sim.snapshot();
    expect(snap.lanes).toEqual([true, true, true, true]);
    expect(snap.laneHeld).toEqual([false, false, false, false]);
    expect(sim.knobReadout(0).value).toBeCloseTo(0.5, 9);

    // …and when the lanes go, the knob is where the hand left it.
    sim.setLaneSource(null);
    expect(sim.knobReadout(0).value).toBe(held);
    expect(values(sim).slice(1)).toEqual(home.slice(1));
  });

  it("every turn starts the five seconds again", () => {
    const write = feed([0.5, 0.5, 0.5, 0.5]);
    write();
    sim.turn(1, 1);
    run(sim, 4000, write);
    write();
    sim.turn(1, 1);
    run(sim, 4000, write);
    expect(sim.snapshot().lanes[1]).toBe(false);
    run(sim, 1200, write);
    expect(sim.snapshot().lanes[1]).toBe(true);
  });

  it("stop when the AUD row is switched off, and come back with it", () => {
    const write = feed([0.2, 0.4, 0.6, 0.8]);
    run(sim, 200, write);
    sim.setMode("network");
    write();
    sim.turn(2, -1);
    sim.tick(FRAME);
    expect(sim.snapshot().rows[1].on).toBe(false);
    expect(sim.snapshot().lanes).toEqual([false, false, false, false]);
    // K3 was turned on the NETWORK screen: the knob's own value did not move.
    expect(values(sim)).toEqual(home);

    // OSC off is not the lanes' switch.
    write();
    sim.turn(2, 1);
    sim.turn(1, -1);
    sim.tick(FRAME);
    expect(sim.snapshot().rows.map((r) => r.on)).toEqual([false, true]);
    // K2 and K3 were just turned by hand: those two are the hand's for five seconds.
    expect(sim.snapshot().lanes).toEqual([true, false, false, true]);
    run(sim, 5100, write);
    expect(sim.snapshot().lanes).toEqual([true, true, true, true]);
  });

  it("give way to the absolute bus on that knob", () => {
    const write = feed([0.5, 0.5, 0.5, 0.5]);
    run(sim, 200, write);
    sim.applyRemoteParam(3, 500);
    write();
    sim.tick(FRAME);
    expect(sim.snapshot().lanes).toEqual([true, true, true, false]);
    expect(sim.knobReadout(3).value).toBe(home[3]);
  });

  it("leave the board as Play expects it: nothing of a visit to the editor's step is left", () => {
    const play = new DeviceSim();
    play.tick(FRAME);
    const origin = [0, 1, 2, 3].map((i) => play.knobReadout(i).value);
    const frames = (s: DeviceSim) => {
      // Same pattern clock in both: compare what the knobs are, and the screen on hold K2.
      s.setMode("network");
      s.tick(FRAME);
      return Array.from(s.frame);
    };

    const visited = new DeviceSim();
    visited.tick(FRAME);
    // The editor's step…
    visited.setEdition("audio");
    visited.setLaneSource("editor");
    for (let i = 0; i < 120; i++) {
      [0, 1, 2, 3].forEach((k) => visited.setLane("editor", k, (i % 10) / 10));
      visited.tick(FRAME);
    }
    // …and then a step of Play's: neither declared.
    visited.setEdition("core");
    visited.setLaneSource(null);
    expect([0, 1, 2, 3].map((i) => visited.knobReadout(i).value)).toEqual(origin);
    expect(visited.snapshot().rows).toEqual([]);
    expect(visited.snapshot().turns).toEqual([0, 0, 0, 0]);
    expect(frames(visited)).toEqual(frames(play));
  });
});
