import type { SimEdition, SimLaneSource, SimMode, SimPack } from "@/lib/guide/deviceSim";
import { kitHeld } from "./timing";
import { useGuideStore, type GuideScreen } from "./store";
import type { DeskPlacement } from "./desk/types";
import { BUILD_SCENES } from "./scenes/build";
import { COMMUNITY_SCENE } from "./scenes/community";
import { LAB_SCENE } from "./scenes/lab";
import { AUDIO_SCENES } from "./scenes/audio";
import type { BuildBeat } from "./stage/build/beats";
import type { BuildViewName } from "./stage/build/views";

// The script. Each scene is a band of the page; each step is one block of
// copy inside it, and the step whose block crosses the middle of the viewport
// is the one on stage. The page (GuideExperience) renders the copy and the
// DOM motion, the stage (GuideCanvas) reads the step here and moves the
// device, the camera and the effects to match.
//
// Knobs are logical: 0..3 = K1..K4, as the device numbers them.
//
// The guide is four guides (pages.ts), each with its own script. SCENES is
// Play (/guide/play, 01–04), BUILD_SCENES (scenes/build.ts) is Build
// (/guide/build) and AUDIO_SCENES (scenes/audio.ts) is Audio (/guide/audio):
// all three are played by the 3D stage. MAKE_SCENES is Make
// (/guide/make, 01–02), whose chapters are in scenes/ and whose stage is the
// desk of app windows (desk/DeskStage.tsx) — its steps say which windows are
// on the desk (DeskStep), not what a device does. Every guide opens on a
// scene called "opening" and ends on one called "next"; which guide's is
// meant is the store's `page`. The hub (/guide, GuideHub) has the stage too,
// playing HUB_SCENES: Play's opening, and nothing after it — what it shows
// besides, while a guide is pointed at, is not script (world/HubAnswers,
// stage/Explode).

export type ViewName =
  | "hero"
  | "front"
  | "back"
  | "screen"
  | "screenKnobs"
  | "knobs"
  | "esp"
  | "espPorts"
  | "espButtons"
  | "wide"
  // The Build guide's own (stage/build/views.ts): the bench, the plates, the case from behind.
  | BuildViewName;

export type DemoAction =
  | { at: number; press: number }
  | { at: number; release: number }
  | { at: number; turn: number; detents: number }
  | { at: number; mode: SimMode };

export type Step = {
  view: ViewName;
  /**
   * The view on a narrow screen, where it must differ: the stage is the top
   * half of a phone, and a view that shows the whole run of a cable there
   * leaves what the step is about — which screw is +5 V — a few pixels wide.
   */
  narrowView?: ViewName;
  /**
   * The Build guide, on a narrow screen: a second view for the later part of
   * the step's beat, from `from` (0…1 through it) on. For a step whose two
   * halves happen in two places — the lead through the case's hole, then
   * into J4 on the board held behind it — which one view shows only as a
   * few pixels each in the strip a phone leaves above the card.
   */
  narrowLate?: { from: number; view: ViewName };
  /** Radians per second the device turns on its own (the opening). */
  spin?: number;
  power: boolean;
  pack: SimPack;
  /** Screen the board is put on when the step starts. */
  mode?: SimMode;
  /**
   * The Audio guide: the firmware the board runs. "audio" is the Audio
   * edition — hold K2 shows the OSC and AUD rows, and K2 / K3 switch them.
   * The Director says it to the board at every step edge (sim.setEdition),
   * and a step that does not declare it is the core firmware: nothing of
   * the edition is left on the board for Play or the hub.
   */
  edition?: SimEdition;
  /**
   * The Audio guide: what drives the four lanes — the knob values, moved
   * without the knobs turning, as sound does on the board. "editor" is the
   * extension's editor in this step's card (EditorWindow, sim.setLane); a
   * hand on a knob takes it for five seconds. The Director opens the lanes
   * at the step's edge (sim.setLaneSource) and a step that does not declare
   * them has none: they are released and the values are what they were.
   */
  lanes?: SimLaneSource;
  focus?: number | null;
  labels?: boolean;
  /** 0 = the ESP32 is in the device, 1 = out in front of it. */
  esp?: number;
  /** The USB-C cable in the left port (KitFx plugs it in once the DevKit is presented). */
  cable?: number;
  /** Which ports / buttons to name on the module. */
  espTags?: ("usb" | "uart" | "boot" | "rst")[];
  flashing?: boolean;
  /** Loop the BOOT/RST download-mode sequence on the module (timing.ts). */
  bootSeq?: boolean;
  /**
   * Point out RST and press it once a loop (timing.ts) — only while the
   * card's flasher screens are at the one that says to, or none are on
   * screen (stage/KitFx.tsx reads which from the store).
   */
  rstPulse?: boolean;
  wifi?: "esp" | "device" | null;
  /**
   * The panel has no network it knows and is its own Wi-Fi network: hold K2
   * shows HOTSPOT and its name instead of CONNECTED and the address
   * (deviceSim setHotspot; KitFx says it to the board every frame). A step
   * that does not declare it has the board on the network.
   */
  hotspot?: boolean;
  /** Pixels streaming from the deck into the panel. */
  stream?: boolean;
  /** A scripted demo, looped every `period` ms while nobody has the knobs. */
  demo?: DemoAction[];
  period?: number;
  /**
   * How long this step's block is, in viewport heights (default 1): a step
   * the reader has to watch loop — BOOT and RST — gets more scroll to stay on.
   */
  dwell?: number;
  /**
   * The Build guide only: which beat of the build this step shows (the
   * storyboard's step id, stage/build/beats.ts). The build stage
   * (stage/build/BuildStage.tsx) plays the beats in order and holds each
   * one's end; build/script.ts has a ready Step for each.
   */
  build?: BuildBeat;
};

/**
 * A step of the Make guide (/guide/make): which app windows are on the desk
 * and which is in front (desk/types.ts DeskPlacement). What the pointer does
 * in them is the chapter's tutorial (tutorials/*.ts), by the same index.
 */
export type DeskStep = {
  desk: DeskPlacement;
  /** As Step's: a longer block for the step to stay on, in viewport heights. */
  dwell?: number;
};

/** A step of either page's script. */
export type AnyStep = Step | DeskStep;

export type SceneDef<S extends AnyStep = Step> = { id: string; steps: S[] };

const base: Pick<Step, "power" | "pack"> = { power: true, pack: "origin" };

// K1..K4 turning in turn, a few detents each way — what "turn" looks like.
const turnAll: DemoAction[] = [0, 1, 2, 3].flatMap((k, i) => {
  const t0 = i * 1100;
  return [
    { at: t0, turn: k, detents: 2 },
    { at: t0 + 150, turn: k, detents: 2 },
    { at: t0 + 300, turn: k, detents: 2 },
    { at: t0 + 550, turn: k, detents: -2 },
    { at: t0 + 700, turn: k, detents: -2 },
  ];
});

export const SCENES: SceneDef[] = [
  {
    id: "opening",
    steps: [{ ...base, view: "hero", spin: 0.22, mode: "run" }],
  },
  {
    id: "flash",
    steps: [
      // 0 — the board that is the brain: the back slides off, the DevKit
      // comes straight off its pins
      { view: "back", power: false, pack: "origin", mode: "off", esp: 0.25 },
      // 1 — out it comes, antenna up
      { view: "esp", power: false, pack: "origin", mode: "off", esp: 1, espTags: [] },
      // 2 — the LEFT port
      { view: "espPorts", power: false, pack: "origin", mode: "off", esp: 1, cable: 1, espTags: ["usb", "uart"] },
      // 3 — download mode first, every first flash: BOOT + RST, slowly,
      // with room to watch it (and the reader's own finger on them: Device.tsx)
      { view: "espButtons", power: false, pack: "origin", mode: "off", esp: 1, cable: 1, bootSeq: true, espTags: ["boot", "rst"], dwell: 1.6 },
      // 4 — Flash Patternflow: data up the cable
      { view: "esp", power: false, pack: "origin", mode: "off", esp: 1, cable: 1, flashing: true },
      // 5 — Wi-Fi, which after a flash from download mode usually takes a
      // second go: RST once, right here, then the flasher again. RST is
      // pressed while the card's first screens say to (or none are up), and
      // never under the Wi-Fi form, where it would cut the setup off; the
      // arcs leave the antenna once it is past RST (KitFx reads which
      // flasher screen is up from the store)
      { view: "esp", power: false, pack: "origin", mode: "off", esp: 1, cable: 1, wifi: "esp", rstPulse: true, espTags: ["rst"] },
      // 6 — back in, power on (the cable comes out first: timing.ts). Stays
      // step 6: the stage's reassembly keys on it (Device.tsx choreoSpeed,
      // GuideCanvas `reassembling`)
      { view: "hero", power: true, pack: "origin", mode: "run", esp: 0 },
      // 7 — still no Wi-Fi: hold K2, and the panel is its own network —
      // HOTSPOT and its name (patternflow-a1b2) on the NETWORK screen, held
      // long enough to read it
      {
        ...base,
        view: "screenKnobs",
        mode: "run",
        focus: 1,
        hotspot: true,
        demo: [
          { at: 0, mode: "run" },
          { at: 300, press: 1 },
          { at: 1400, release: 1 },
          // K2 = EXIT, before the screen's own eight seconds run out.
          { at: 7600, press: 1 },
          { at: 7750, release: 1 },
        ],
        period: 9000,
      },
    ],
  },
  {
    id: "knobs",
    steps: [
      // 0 — four knobs, numbered from the top right
      { ...base, view: "knobs", mode: "run", labels: true },
      // 1 — turn
      { ...base, view: "screenKnobs", mode: "run", labels: true, demo: turnAll, period: 4800 },
      // 2 — click
      {
        ...base,
        view: "screenKnobs",
        mode: "run",
        focus: 0,
        demo: [
          { at: 0, turn: 0, detents: 6 },
          { at: 200, turn: 0, detents: 6 },
          { at: 1400, press: 0 },
          { at: 1600, release: 0 },
        ],
        period: 3000,
      },
      // 3 — hold K1: brightness
      {
        ...base,
        view: "screenKnobs",
        mode: "run",
        focus: 0,
        demo: [
          { at: 0, mode: "run" },
          { at: 400, press: 0 },
          { at: 1500, release: 0 },
          { at: 1900, turn: 0, detents: -4 },
          { at: 2100, turn: 0, detents: -4 },
          { at: 2300, turn: 0, detents: -4 },
          { at: 3200, turn: 0, detents: 4 },
          { at: 3400, turn: 0, detents: 4 },
          { at: 3600, turn: 0, detents: 4 },
          { at: 4600, press: 0 },
          { at: 4700, release: 0 },
        ],
        period: 5600,
      },
      // 4 — hold K2: network
      {
        ...base,
        view: "screenKnobs",
        mode: "run",
        focus: 1,
        demo: [
          { at: 0, mode: "run" },
          { at: 400, press: 1 },
          { at: 1500, release: 1 },
          // K2 = EXIT, as the screen says.
          { at: 4600, press: 1 },
          { at: 4750, release: 1 },
        ],
        period: 6000,
      },
      // 5 — hold K3: knob map
      {
        ...base,
        view: "screenKnobs",
        mode: "run",
        focus: 2,
        demo: [
          { at: 0, mode: "run" },
          { at: 400, press: 2 },
          { at: 1500, release: 2 },
          { at: 2100, turn: 0, detents: 1 },
          { at: 2800, turn: 1, detents: 1 },
          { at: 3500, turn: 2, detents: 1 },
          { at: 4200, turn: 3, detents: 1 },
          // K3 = EXIT.
          { at: 5000, press: 2 },
          { at: 5150, release: 2 },
        ],
        period: 6200,
      },
      // 6 — hold K4: patterns
      {
        ...base,
        view: "screenKnobs",
        mode: "run",
        focus: 3,
        demo: [
          { at: 0, mode: "run" },
          { at: 400, press: 3 },
          { at: 1500, release: 3 },
          { at: 2400, turn: 3, detents: 1 },
          { at: 3000, turn: 3, detents: 1 },
          { at: 3600, turn: 3, detents: 1 },
          // Hold K4 again to close it: the ring fills, then the list goes.
          { at: 4300, press: 3 },
          { at: 5500, release: 3 },
        ],
        period: 6400,
      },
    ],
  },
  {
    id: "patterns",
    steps: [
      // 0 — only Origin
      { ...base, view: "screen", mode: "select" },
      // 1 — the Basics deck (a deck, or a single pattern)
      { ...base, view: "front", mode: "run", stream: true },
      // 2 — install, format, done
      { ...base, view: "front", mode: "run", stream: true },
      // 3 — 1 / 34
      {
        view: "screenKnobs",
        power: true,
        pack: "basics",
        mode: "select",
        focus: 3,
        demo: [
          { at: 700, turn: 3, detents: 3 },
          { at: 1400, turn: 3, detents: 3 },
          { at: 2100, turn: 3, detents: 3 },
          { at: 2800, turn: 3, detents: 3 },
          { at: 3500, turn: 3, detents: 3 },
        ],
        period: 4200,
      },
    ],
  },
  {
    id: "console",
    steps: [
      // 0 — patternflow.local
      { view: "wide", power: true, pack: "basics", mode: "run", wifi: "device" },
      // 1 — on a phone: the IP from K2
      {
        view: "screenKnobs",
        power: true,
        pack: "basics",
        mode: "run",
        focus: 1,
        demo: [
          { at: 0, mode: "run" },
          { at: 300, press: 1 },
          { at: 1400, release: 1 },
          { at: 7600, press: 1 },
          { at: 7750, release: 1 },
        ],
        period: 9000,
      },
      // 2 — what is in it
      { view: "front", power: true, pack: "basics", mode: "run", wifi: "device" },
    ],
  },
  {
    id: "next",
    steps: [{ view: "hero", spin: 0.18, power: true, pack: "basics", mode: "run" }],
  },
];

// The Make guide, "Make your own": a desk of app windows instead of the
// device — the community and the Lab are things you do on a screen. It opens
// with the practice community in front and the Lab behind it, both at rest
// (dimmed, nothing pointed at yet), and ends on the reader's Lab.
export const MAKE_SCENES: SceneDef<DeskStep>[] = [
  {
    id: "opening",
    steps: [{ desk: { front: "community", show: ["community", "lab"], rest: true } }],
  },
  COMMUNITY_SCENE,
  LAB_SCENE,
  {
    id: "next",
    steps: [{ desk: { front: "lab", rest: true } }],
  },
];

// The hub (/guide): the device as Play's opening shows it, turning slowly
// beside the three guides. The hub has no scroll story, so this is all it plays.
const HUB_SCENES: SceneDef[] = [SCENES[0]];

// The scripts the 3D stage plays, by page. The stage is one for the whole
// guide and stays up between pages (world/GuideWorld). Make has the desk
// instead: there the device stands far back, faded and at rest, and what it
// holds meanwhile is Play's opening — the device whole and lit, which is how
// it comes back.
const STAGE_SCENES: Record<GuideScreen, SceneDef[]> = { build: BUILD_SCENES, play: SCENES, make: SCENES, audio: AUDIO_SCENES, hub: HUB_SCENES };

const PAGE_SCENES: Record<GuideScreen, SceneDef<AnyStep>[]> = { build: BUILD_SCENES, play: SCENES, make: MAKE_SCENES, audio: AUDIO_SCENES, hub: HUB_SCENES };

/** A page's script, opening to end. */
export function scenesOf(page: GuideScreen): SceneDef<AnyStep>[] {
  return PAGE_SCENES[page];
}

/** A scene of the page the reader is on (or of `page`). */
export function sceneById(id: string, page: GuideScreen = useGuideStore.getState().page): SceneDef<AnyStep> | undefined {
  return scenesOf(page).find((s) => s.id === id);
}

/** A step of the Make guide's script (clamped into its scene; the opening's for an unknown scene). */
export function deskStepOf(scene: string, step: number): DeskStep {
  const def = MAKE_SCENES.find((s) => s.id === scene) ?? MAKE_SCENES[0];
  return def.steps[Math.max(0, Math.min(def.steps.length - 1, step))];
}

// A step as the stage should play it right now. The one difference from the
// script: while the USB-C cable is still on the DevKit, the DevKit stays out
// where it is (esp held at 1) — the plug has to come out and the cable go
// before it can travel anywhere, whichever step the reader has scrolled to.
const heldSteps = new WeakMap<Step, Step>();

export function stepOf(scene: string, step: number): Step {
  // The 3D stage plays the page's own script — Play's, Build's, Audio's, the hub's.
  // Make has the desk instead (MAKE_SCENES, deskStepOf).
  const scenes = STAGE_SCENES[useGuideStore.getState().page];
  const def = scenes.find((s) => s.id === scene) ?? scenes[0];
  const s = def.steps[Math.max(0, Math.min(def.steps.length - 1, step))];
  if ((s.esp ?? 0) < 1 && kitHeld()) {
    let held = heldSteps.get(s);
    if (!held) {
      held = { ...s, esp: 1 };
      heldSteps.set(s, held);
    }
    return held;
  }
  return s;
}
