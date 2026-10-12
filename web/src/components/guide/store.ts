import { create } from "zustand";
import { DeviceSim } from "@/lib/guide/deviceSim";
import { buildClock } from "./timing";

// The guide's shared state. Scroll position is written here many times a
// second, so nothing that renders React should subscribe to `progress`: the
// 3D stage reads it with getState() inside its frame loop, and the page's own
// motion reads the --p custom property the scroll tracker sets on each scene.
// Components subscribe to `scene` and `step`, which only change at edges.
//
// The guide is one world (world/GuideWorld, mounted by app/guide/layout.tsx):
// the stage stays up while the reader goes between the hub and the guides, in
// either language. A page says it is the one on screen with enterPage (a
// page does it through world/usePage.ts), and everything the stage does
// between two pages — the hub's answers, the device coming apart, the build
// winding back, the camera's move — is read from here.

export type GuideLang = "en" | "ko";

/**
 * The guides (pages.ts), in the order a reader goes through them: "build" is
 * /guide/build (soldering one from bare parts), "play" /guide/play (01 Flash
 * to 04 Console), "make" /guide/make (01 Community, 02 Pattern Lab). Each
 * numbers its own chapters from 01. "audio" is /guide/audio: the Audio
 * edition, then three sections in no order (a browser tab, the microphone,
 * MIDI and a DAW) — the one guide whose chapters carry no number.
 */
export type GuidePageId = "build" | "play" | "make" | "audio";

/** What the stage can be showing: a guide, or /guide itself — the hub, where the reader picks one (GuideHub). */
export type GuideScreen = GuidePageId | "hub";

type GuideState = {
  /**
   * The page the reader is on. Scene ids are the page's own — every guide
   * has an "opening" and a "next" — so a step is looked up in this page's
   * script (scenes.ts sceneById): the 3D stage's on the build and play
   * guides and the hub (stepOf), the desk's on the make guide (deskStepOf).
   */
  page: GuideScreen;
  /** The language of the page on screen (the stage's own words follow it: the Build stage's tags). */
  lang: GuideLang;
  /** A page has said which one it is: false until the first enterPage (the stage waits for it). */
  entered: boolean;
  /**
   * The hub: the guide the reader is pointing at, with the mouse or the
   * keyboard. The device answers it (world/HubAnswers, stage/Explode, the
   * camera). Null everywhere else, and on the hub when nothing is pointed at.
   */
  preview: GuidePageId | null;
  /**
   * A way out of this page has been chosen (world/GuideLink) and the next
   * page has not arrived yet: the words go, the stage holds what it is
   * showing — on the hub, the chosen guide's answer. Null otherwise.
   */
  leaving: GuideScreen | null;
  /** The hub: where its choices start, px from the top of the screen (GuideHub measures it); 0 until measured. */
  hubTop: number;
  /**
   * The Build stage is on the canvas. True from the moment the Build guide
   * is entered; leaving the guide, the stage stays until it has run the build
   * to the whole device (BuildStage), and takes itself off here. The hub
   * also turns it on, in standby, once the reader lingers on Build
   * (world/HubAnswers): it readies itself there and shows nothing.
   */
  buildLive: boolean;
  /**
   * Counts the cuts asked for: moments the stage must jump — too far to
   * play — and does it with the canvas dipped to dark (requestCut; the world
   * shows it, Guide.module.css [data-cut]).
   */
  cut: number;
  /** The scene whose band contains the middle of the viewport. */
  scene: string;
  /** 0..1 through that scene. */
  progress: number;
  /**
   * The current step's card has come onto the screen. A chapter's first step
   * is the current one from the moment the chapter's title reaches the middle
   * of the screen, a screen and more before its card does; the Build stage
   * (BuildStage) holds that step's motion until this is true, so it plays
   * for the reader and not under the title.
   */
  cardIn: boolean;
  /** Counts up each time the reader asks to see the current step's motion again (the Build guide's cards). */
  replay: number;
  /** Index of the step inside the scene, derived from progress by the scene's script. */
  step: number;
  /** The reader has taken the knobs: scripted demos pause, the camera settles. */
  handsOn: boolean;
  /** Narrow screen: the stage sits above the text instead of beside it. */
  narrow: boolean;
  /**
   * The flasher screens a card is playing right now (FlasherShots), so the
   * DevKit on stage can act out the one on screen: on the Wi-Fi card, RST
   * is pressed while the first screen of the usual way ("Usually: after
   * RST") is up, and never under the Wi-Fi form. `at` is when this screen
   * came up (performance.now()). Null when no flasher viewer is on screen.
   */
  flasher: { set: string; index: number; at: number } | null;
  /** The DevKit is held up in front of the reader (KitFx), so a card about it can start. */
  kitPresented: boolean;
  /**
   * A page of the guide has mounted. Another page: its script, from its top
   * (the scroll tracker takes over at once). The same page again — the other
   * language, most often — keeps the step the stage is on: the new page is
   * scrolled to it (GuideLink), and nothing on stage starts over.
   */
  enterPage: (page: GuideScreen, lang?: GuideLang) => void;
  /** The hub: the guide pointed at, or null. Ignored once a way out has been chosen. */
  setPreview: (guide: GuidePageId | null) => void;
  /** A way out has been chosen (GuideLink). On the hub, a guide chosen is a guide pointed at. */
  leaveFor: (page: GuideScreen | null) => void;
  setHubTop: (px: number) => void;
  setBuildLive: (on: boolean) => void;
  /** The stage is about to jump: dip the canvas for it. The jump itself waits ~170 ms, until the canvas is out. */
  requestCut: () => void;
  setScroll: (scene: string, progress: number, step: number, cardIn?: boolean) => void;
  replayStep: () => void;
  setHandsOn: (on: boolean) => void;
  setNarrow: (narrow: boolean) => void;
  setFlasher: (f: { set: string; index: number } | null) => void;
  setKitPresented: (on: boolean) => void;
};

export const useGuideStore = create<GuideState>((set, get) => ({
  page: "play",
  lang: "en",
  entered: false,
  preview: null,
  leaving: null,
  hubTop: 0,
  buildLive: false,
  cut: 0,
  scene: "opening",
  progress: 0,
  step: 0,
  cardIn: true,
  replay: 0,
  handsOn: false,
  narrow: false,
  flasher: null,
  kitPresented: false,
  enterPage: (page, lang) => {
    const s = get();
    const next = lang ?? s.lang;
    if (s.entered && s.page === page) {
      // The same page, mounted again: the stage carries on where it is.
      if (s.lang !== next || s.leaving !== null) set({ lang: next, leaving: null });
      return;
    }
    set({
      page,
      lang: next,
      entered: true,
      preview: null,
      leaving: null,
      // The Build stage: on with its guide; off it, kept only while it is
      // still showing something (timing.ts buildClock: −1 until it has drawn).
      buildLive: page === "build" || (s.buildLive && buildClock.t >= 0),
      scene: "opening",
      progress: 0,
      step: 0,
      cardIn: true,
      handsOn: false,
      flasher: null,
    });
  },
  setPreview: (preview) => {
    const s = get();
    if (s.leaving !== null || s.page !== "hub" || s.preview === preview) return;
    set({ preview });
  },
  leaveFor: (leaving) => {
    const s = get();
    if (s.leaving === leaving) return;
    // The guide chosen on the hub is the one the device answers, pointed at or not (a tap, a key).
    set(leaving !== null && leaving !== "hub" && s.page === "hub" ? { leaving, preview: leaving } : { leaving });
  },
  setHubTop: (hubTop) => {
    if (get().hubTop !== hubTop) set({ hubTop });
  },
  setBuildLive: (buildLive) => {
    if (get().buildLive !== buildLive) set({ buildLive });
  },
  requestCut: () => set({ cut: get().cut + 1 }),
  setScroll: (scene, progress, step, cardIn = true) => {
    const s = get();
    if (s.scene !== scene || s.step !== step) {
      // Moving to another step hands the knobs back to the script.
      set({ scene, progress, step, cardIn, handsOn: false });
    } else if (s.progress !== progress || s.cardIn !== cardIn) {
      set({ progress, cardIn });
    }
  },
  replayStep: () => set({ replay: get().replay + 1 }),
  setHandsOn: (handsOn) => set({ handsOn }),
  setNarrow: (narrow) => {
    if (get().narrow !== narrow) set({ narrow });
  },
  setFlasher: (f) => {
    const cur = get().flasher;
    if (!f) {
      if (cur) set({ flasher: null });
    } else if (!cur || cur.set !== f.set || cur.index !== f.index) {
      set({ flasher: { ...f, at: performance.now() } });
    }
  },
  setKitPresented: (kitPresented) => {
    if (get().kitPresented !== kitPresented) set({ kitPresented });
  },
}));

// One simulated board for the whole guide. Module scope rather than state
// because it is an imperative object ticked from the render loop, and the DOM
// control pad and the 3D knobs must reach the same one.
let sim: DeviceSim | null = null;
export function getSim(): DeviceSim {
  if (!sim) sim = new DeviceSim();
  return sim;
}
