// Clocks and hand-offs shared between the page and the stage.
//
// The BOOT/RST sequence is drawn twice: as three chips in the card
// (Extras.tsx, BootSeq) and as the buttons, rings and tags on the 3D DevKit
// (stage/KitFx.tsx). Both read the same loop off the same clock,
// performance.now() modulo the period, so they can't drift apart.

/**
 * Download mode by hand, slowly enough to follow: BOOT goes down at 0 and is
 * held; RST is tapped from 1.0 to 1.7 s while BOOT is still down; BOOT comes
 * up at 2.6 s; then a rest before it starts again.
 */
export const BOOT_SEQ = {
  period: 5000,
  bootDown: 0,
  rstDown: 1000,
  rstUp: 1700,
  bootUp: 2600,
  /** How long the "Release BOOT" chip stays lit after BOOT comes up. */
  releaseShown: 1000,
} as const;

export type BootPhase = {
  /** ms into the loop */
  k: number;
  bootDown: boolean;
  rstDown: boolean;
  /** The chips: hold BOOT (lit for as long as it is held), tap RST, release BOOT. */
  chips: [boolean, boolean, boolean];
};

export function bootPhase(now: number = performance.now()): BootPhase {
  const b = BOOT_SEQ;
  const k = ((now % b.period) + b.period) % b.period;
  const bootDown = k >= b.bootDown && k < b.bootUp;
  const rstDown = k >= b.rstDown && k < b.rstUp;
  const released = k >= b.bootUp && k < b.bootUp + b.releaseShown;
  return { k, bootDown, rstDown, chips: [bootDown, rstDown, released] };
}

/**
 * RST alone, once per loop: where it is, for the Wi-Fi step — after a flash
 * from download mode the board starts Patternflow only once RST is pressed,
 * and the flasher's Wi-Fi comes after that.
 */
export const RST_PULSE = { period: 4400, down: 1600, up: 2000 } as const;

export function rstPulseDown(now: number = performance.now()): boolean {
  const k = ((now % RST_PULSE.period) + RST_PULSE.period) % RST_PULSE.period;
  return k >= RST_PULSE.down && k < RST_PULSE.up;
}

/**
 * The cable and the DevKit take turns. KitFx writes `cable`: 0 when there is
 * no cable, 1 when it hangs unplugged below the port, 2 when the plug is all
 * the way in. While it is anything but 0 the DevKit stays where it is being
 * held (scenes.ts's stepOf holds its travel at "presented"), so the plug
 * always comes out and the cable leaves before the DevKit goes anywhere, and
 * the cable never swings round with it. `seated` is true once the DevKit is
 * back on its pins, for anything that should wait for that (power).
 */
export const kitState = {
  cable: 0,
  seated: true,
  /** Held up in front of the reader, where the DevKit views look. */
  presented: false,
  /**
   * Clear of the case's side on its way to or from the front. Until then a
   * DevKit view has nothing to look at in front, so the camera watches it
   * come out from behind instead (GuideCanvas).
   */
  out: false,
  /** On its pins with the back cover slid shut: the device is whole again (power waits for this). */
  home: true,
};

/**
 * Where the Build guide's stage is on its timeline (stage/build/beats.ts: a
 * beat's index plus how far through it, 0…1). BuildStage writes it every
 * frame; −1 until it has drawn one — it loads after the device. The camera
 * and the scripted demos read it: a step that changes view part-way through
 * its beat (scenes.ts narrowLate), and a demo that must not start before the
 * build has got to its step (GuideCanvas Director).
 */
export const buildClock = { t: -1 };

/** True while the cable is anywhere near the DevKit. */
export function kitHeld(): boolean {
  return kitState.cable > 0.001;
}
