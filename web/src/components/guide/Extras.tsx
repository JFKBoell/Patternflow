"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import styles from "./Guide.module.css";
import { COPY, type AudioShotSet, type Extra } from "./copy";
import { AUDIO_COPY } from "./copy/audio";
import type { GuideLang } from "./store";
import { communityHref } from "@/lib/community/apiBase";
import { PatternRuntime } from "@/lib/pattern/harness";
import { parseRampAnnotation } from "@/lib/pattern/ramp";
import { hexToRgb } from "@/lib/pattern/color";
import { knobSetupFromCode, normalizedKnobs } from "@/lib/community/knobs";
import { livePresets } from "@/lib/presets";
import { BASICS_PACK } from "@/lib/pattern/packs";
import { BASICS_NAMES } from "@/lib/guide/basicsNames";
import { bootPhase } from "./timing";
import FlasherShots from "./FlasherShots";
import ConsoleWindow, { type ConsolePage } from "./ConsoleWindow";
import CommunityShots from "./CommunityShots";
import LabShots from "./LabShots";
import LabWindow from "./LabWindow";
import BuildCards from "./build/BuildCards";
import type { BuildCard } from "./build/cards";

// The Audio guide's two (the editor in its window, the captures): loaded
// with that guide's cards, so the other guides do not carry them.
const EditorWindow = dynamic(() => import("./EditorWindow"));
const AudioShots = dynamic(() => import("./AudioShots"));

// The small moving pieces that sit inside a step's card: BOOT and RST in
// order, the flasher's real button and its real screens, a deck fanning
// out, the board's own page installing a pack, the console itself —
// working, on a simulated board.

const EspWebInstallButton = "esp-web-install-button" as unknown as React.FC<{
  children: React.ReactNode;
  manifest: string;
  ref?: React.Ref<HTMLElement>;
}>;

/** Runs `fn(elapsedMs)` on an interval while the element is on screen. */
function useVisibleTicker(ref: React.RefObject<HTMLElement | null>, ms: number, fn: (t: number) => void) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    const start = performance.now();
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !timer) {
        timer = window.setInterval(() => fnRef.current(performance.now() - start), ms);
      } else if (!entry.isIntersecting && timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) window.clearInterval(timer);
    };
  }, [ref, ms]);
}

/** Index into a list of stage durations, looping. */
function stageAt(t: number, durations: number[]) {
  const total = durations.reduce((a, b) => a + b, 0);
  let local = t % total;
  for (let i = 0; i < durations.length; i++) {
    if (local < durations[i]) return { index: i, within: local / durations[i] };
    local -= durations[i];
  }
  return { index: 0, within: 0 };
}

// ── flashing ────────────────────────────────────────────────────────────────

/**
 * The flasher's real button: it opens ESP Web Tools' install dialog, for
 * real. On two cards — Flash, and Wi-Fi, which presses it a second time to
 * reach Patternflow's own menu — so neither has the reader scroll back for it.
 */
function FlashButton({ lang }: { lang: GuideLang }) {
  const ui = COPY[lang].ui;
  // The install button is a custom element with a shadow root, and the site's
  // session recorder keeps a handler on every shadow root made while it runs,
  // for good. The root holds its host, the host its parent, and so on up: each
  // visit to Play left the whole page's DOM alive behind it (some 730
  // elements a visit). So when the page has gone, the button is taken out of
  // it: what stays held is the button alone.
  const button = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = button.current;
    return () => {
      // Only once the page is really out of the document (in development an
      // effect is run, undone and run again on a page that is still there).
      if (el && !el.isConnected) el.remove();
    };
  }, []);
  return (
    <>
      {/* Loaded once for the page, however many cards carry the button. */}
      <Script type="module" src="https://unpkg.com/esp-web-tools@10/dist/web/install-button.js?module" strategy="lazyOnload" />
      <EspWebInstallButton ref={button} manifest="/flash/manifest.json">
        <button slot="activate" type="button" className={`${styles.action} ${styles.actionFirst}`}>
          Flash Patternflow
        </button>
        <span slot="unsupported" className={styles.muted}>
          {ui.flashUnsupported}
        </span>
      </EspWebInstallButton>
    </>
  );
}

// The button first — it is the step — then what it opens, screen by screen
// (FlasherShots: the dialog's own screens, captured). The card before it has
// put the board in download mode (BootSeq).
function FlashBlock({ lang }: { lang: GuideLang }) {
  return (
    <div className={styles.extra}>
      <FlashButton lang={lang} />
      <FlasherShots set="install" lang={lang} waitForKit />
    </div>
  );
}

// Download mode by hand, the first thing every first flash does: the
// card's three chips.
function BootSeq({ lang }: { lang: GuideLang }) {
  const ui = COPY[lang].ui;
  const ref = useRef<HTMLOListElement>(null);
  // Which chips are lit, as bits. The module on stage (KitFx) reads the same
  // loop off the same clock (timing.ts), so the chips and the buttons agree:
  // "Hold BOOT" stays lit for as long as BOOT is down, "Tap RST" while RST is.
  const [lit, setLit] = useState(0);
  useVisibleTicker(ref, 50, () => {
    const { chips } = bootPhase();
    setLit((chips[0] ? 1 : 0) | (chips[1] ? 2 : 0) | (chips[2] ? 4 : 0));
  });
  return (
    <ol className={styles.seq} ref={ref}>
      {ui.bootSteps.map((s, i) => (
        <li key={s} data-on={lit & (1 << i) ? "1" : "0"}>
          <span>{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

// The Wi-Fi, the usual way first — RST, then the button again, which now
// opens on Patternflow's own menu (the DevKit on stage presses RST while
// that first screen is up: KitFx) — then the lucky one, straight after the
// install.
function WifiShots({ lang }: { lang: GuideLang }) {
  return (
    <div className={styles.extra}>
      <FlashButton lang={lang} />
      <FlasherShots set={["dashboard", "wifi"]} lang={lang} waitForKit />
    </div>
  );
}

// ── patterns ────────────────────────────────────────────────────────────────

// Five of the pack's own modules (web/public/packs/basics.json), front card last.
const FAN_SLUGS = ["wave_saw", "0510", "0513", "0518", "0520"];

const NO_BUTTONS = [false, false, false, false];
const NO_TURNS = [0, 0, 0, 0];

/** A pattern of the pack, ready to play on a card (null: the slug has no JS twin). */
function thumbRuntime(slug: string) {
  const num = BASICS_PACK.presets[slug];
  const preset = num === undefined ? null : (livePresets.find((p) => p.num === num) ?? null);
  if (!preset) return null;
  const rt = new PatternRuntime(128, 64);
  const a = parseRampAnnotation(preset.code);
  if (a) {
    rt.setRamp({
      stops: a.stops.map((s) => ({ position: s.position, color: hexToRgb(s.color) })),
      mode: a.mode,
      wrap: a.wrap,
    });
    rt.recolor = a.recolor;
  } else {
    rt.setRamp({
      stops: [
        { position: 0, color: [8, 24, 64] },
        { position: 0.55, color: [255, 77, 0] },
        { position: 1, color: [255, 232, 154] },
      ],
      mode: "linear",
      wrap: false,
    });
  }
  rt.loadCode(preset.code);
  const setup = knobSetupFromCode(preset.code);
  return { rt, setup, knobs: normalizedKnobs(setup.values, setup.ranges), last: 0, time: 0 };
}
type Thumb = NonNullable<ReturnType<typeof thumbRuntime>> & { ctx: CanvasRenderingContext2D; img: ImageData };

/** What the cards may take of a frame, on average, ms. */
const THUMB_MS = 2.5;
/** With less motion asked for a card shows one picture: the pattern this far in (its first frame is often an empty one), in steps of a tenth of a second. */
const STILL_STEPS = 12;

/**
 * Patterns of the pack playing on small cards — Play's deck (a fan), and the
 * head of Make where there is no desk (a band).
 *
 * They are drawn on the page's own thread, the one the stage draws from, so
 * they take as little of it as they can. One card is drawn at a time, never
 * two in a frame — all five every frame made this step twice the cost of any
 * other — and how often is paced by what a card costs on this machine: every
 * frame where a pattern takes a millisecond, every second or third where it
 * takes five (THUMB_MS a frame, on average). In the fan the card in front,
 * the only one seen whole, takes every other turn. Nothing is made until the
 * cards first come onto the screen; nothing runs while they are off it, or
 * while their step's card is not the one being read; and with less motion
 * asked for each card is drawn once — a card a frame — and left.
 */
export function LiveThumbs({ slugs, variant = "fan" }: { slugs: string[]; variant?: "fan" | "band" }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    // One runtime per card, kept on that card's index: a slug with no JS twin
    // leaves its own card dark rather than shifting every card after it.
    let cards: Thumb[] | null = null;
    const make = () =>
      slugs.flatMap((slug, i): Thumb[] => {
        const entry = thumbRuntime(slug);
        const ctx = canvases.current[i]?.getContext("2d");
        if (!entry || !ctx) return [];
        // One picture a card, written over every time (its alpha set once, here).
        const img = new ImageData(128, 64);
        img.data.fill(255);
        return [{ ...entry, ctx, img }];
      });
    const advance = (card: Thumb, dt: number) => {
      card.time += dt;
      card.rt.renderFrame(dt, card.time, {
        knobDeltas: NO_TURNS,
        knobValues: card.setup.values,
        knobNormalized: card.knobs,
        knobRanges: card.setup.ranges,
        btnPressed: NO_BUTTONS,
        btnHeld: NO_BUTTONS,
      });
    };
    const paint = (card: Thumb, dt: number) => {
      advance(card, dt);
      const d = card.rt.data;
      const out = card.img.data;
      // (The card's alpha stays as it was made: full.)
      for (let j = 0; j < d.length; j += 4) {
        out[j] = d[j];
        out[j + 1] = d[j + 1];
        out[j + 2] = d[j + 2];
      }
      card.ctx.putImageData(card.img, 0, 0);
    };

    // The step whose card these are in, if any: they play while it is the one on.
    const step = el.closest<HTMLElement>("[data-step]");
    let raf = 0;
    let visible = false;
    let turn = 0;
    /** What drawing one card costs here, ms (eased), and the frames to sit out before the next. */
    let cost = 1;
    let rest = 0;
    /** Less motion: how many of the cards have their one picture. */
    let stills = 0;
    const playing = () => visible && (!step || step.dataset.on !== "0");
    const next = (all: Thumb[]) => {
      const n = turn++;
      // The fan: the front card (the last) every other turn, the ones behind it in between.
      if (variant === "fan" && all.length > 1) return n % 2 ? all[(n >> 1) % (all.length - 1)] : all[all.length - 1];
      return all[n % all.length];
    };
    const loop = (now: number) => {
      raf = 0;
      if (!playing() || !cards?.length) return;
      if (still) {
        // One picture a card, a card a frame, and that is all.
        if (stills >= cards.length) return;
        const card = cards[stills++];
        for (let n = 1; n < STILL_STEPS; n++) advance(card, 0.1);
        paint(card, 0.1);
        raf = requestAnimationFrame(loop);
        return;
      }
      raf = requestAnimationFrame(loop);
      if (rest > 0) {
        rest--;
        return;
      }
      const card = next(cards);
      const dt = card.last ? Math.min(0.4, (now - card.last) / 1000) : 1 / 30;
      card.last = now;
      const began = performance.now();
      paint(card, dt);
      cost += (performance.now() - began - cost) * 0.25;
      rest = Math.min(5, Math.max(0, Math.ceil(cost / THUMB_MS) - 1));
    };
    const wake = () => {
      if (!playing()) return;
      // Made the first time they are wanted (a pattern's code is compiled here), drawn from the next frame on.
      cards ??= make();
      // After a rest a card carries on from where it stopped, not a rest later.
      for (const card of cards) card.last = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      wake();
    });
    io.observe(el);
    const mo = step ? new MutationObserver(wake) : null;
    if (step) mo?.observe(step, { attributes: true, attributeFilter: ["data-on"] });
    return () => {
      io.disconnect();
      mo?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [slugs, variant]);

  if (variant === "band") {
    return (
      <div className={styles.band} ref={wrap} aria-hidden="true">
        {slugs.map((slug, i) => (
          <canvas
            key={slug}
            ref={(el) => {
              canvases.current[i] = el;
            }}
            width={128}
            height={64}
          />
        ))}
      </div>
    );
  }
  return (
    <div className={styles.fan} ref={wrap} aria-hidden="true">
      {slugs.map((slug, i) => (
        <div key={slug} className={styles.fanCard} style={{ "--i": i - (slugs.length - 1) / 2 } as React.CSSProperties}>
          <canvas
            ref={(el) => {
              canvases.current[i] = el;
            }}
            width={128}
            height={64}
          />
        </div>
      ))}
    </div>
  );
}

function DeckFan({ lang }: { lang: GuideLang }) {
  const ui = COPY[lang].ui;
  return (
    <div className={styles.extra}>
      <LiveThumbs slugs={FAN_SLUGS} />
      <div className={styles.deckMeta}>
        <span className={styles.deckName}>Basics</span>
        <span className={styles.deckCount}>33</span>
      </div>
      <a className={styles.action} href={communityHref("/community/decks")}>
        {ui.openDecks} <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

// The board's Patterns page as the pack arrives, in its own words: the
// format prompt, the browser's confirm, then the upload queue — a row per
// file, each fetched from the community and handed to the board.
// The pack's order: each module's .pfm, then its .json.
const QUEUE = Object.keys(BASICS_NAMES).flatMap((slug) => [`${slug}.pfm`, `${slug}.json`]);
// The page's own row states: the transfer counts to 90 %, then the row reads
// "verifying…" until the board confirms the file (patterns.html runQ).
const UPLOAD_SHARE = 0.72;

function InstallFlow({ lang }: { lang: GuideLang }) {
  const ui = COPY[lang].ui.install;
  const ref = useRef<HTMLDivElement>(null);
  const [st, setSt] = useState({ index: 0, within: 0 });
  useVisibleTicker(ref, 60, (t) => setSt(stageAt(t, [2000, 1500, 900, 3800, 2200])));
  // The queue: the file uploading now, the one before it done, the next waiting.
  const pos = st.index === 3 ? st.within * QUEUE.length : st.index === 4 ? QUEUE.length : 0;
  const cur = Math.min(QUEUE.length - 1, Math.floor(pos));
  const f = pos - Math.floor(pos);
  const verifying = f >= UPLOAD_SHARE;
  const pct = verifying ? 90 : Math.round((f / UPLOAD_SHARE) * 90);
  const rows =
    st.index === 4
      ? QUEUE.slice(-3).map((name) => ({ name, state: "✓ done", on: false }))
      : [cur - 1, cur, cur + 1].map((i) => ({
          name: QUEUE[i] ?? "",
          state: i < cur ? "✓ done" : i === cur ? (verifying ? "verifying…" : `uploading ${pct}%`) : "waiting",
          on: i === cur,
        }));
  return (
    <div className={styles.extra} ref={ref} aria-hidden="true">
      <div className={styles.mockWindow}>
        <div className={styles.mockBar}>
          <span />
          <span />
          <span />
          <b>patternflow.local/patterns</b>
        </div>
        <div className={`${styles.mockBody} ${styles.mockTall}`}>
          {st.index === 0 && (
            <>
              <p className={styles.mockLine}>Storage needs formatting</p>
              <span className={styles.mockButton} data-pressed={st.within > 0.72 ? "1" : "0"}>
                Format storage
              </span>
            </>
          )}
          {st.index === 1 && (
            <>
              <p className={styles.mockLine}>Format pattern storage?</p>
              <p className={styles.mockSub}>{ui.confirm}</p>
              <span className={styles.mockButtons}>
                <span className={styles.mockButton} data-quiet="1">
                  Cancel
                </span>
                <span className={styles.mockButton} data-pressed={st.within > 0.7 ? "1" : "0"}>
                  OK
                </span>
              </span>
            </>
          )}
          {st.index === 2 && <p className={styles.mockLine}>formatting…</p>}
          {st.index >= 3 && (
            <ul className={styles.mockQueue}>
              {rows.map((r, i) =>
                r.name ? (
                  <li key={i} data-on={r.on ? "1" : "0"}>
                    <span>{r.name}</span>
                    <em>{r.state}</em>
                    {r.on && (
                      <i className={styles.mockProgress}>
                        <span style={{ width: `${pct}%` }} />
                      </i>
                    )}
                  </li>
                ) : (
                  <li key={i} />
                ),
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── console ─────────────────────────────────────────────────────────────────

// The device's real console pages on a simulated board (ConsoleWindow): a
// click lifts the window beside the 3D board, and both act on the same one.
function ConsoleTour({ lang }: { lang: GuideLang }) {
  const pages = COPY[lang].ui.pages;
  const [page, setPage] = useState<ConsolePage>(pages[0].id);
  return (
    <div className={styles.extra}>
      <div className={styles.tour} role="group" aria-label={COPY[lang].ui.tourLabel}>
        {pages.map((p) => (
          <button key={p.id} type="button" className={styles.tourTab} aria-pressed={p.id === page} onClick={() => setPage(p.id)}>
            {p.title}
          </button>
        ))}
      </div>
      <ConsoleWindow variant="desktop" page={page} lang={lang} />
      {/* Every page's line in one grid cell: the block is as tall as the
          longest, so the card (and the tabs under the pointer) doesn't move
          when a shorter one comes up. */}
      <div className={styles.tourNotes}>
        {pages.map((p) => (
          <p key={p.id} className={styles.tourNote} data-on={p.id === page ? "1" : "0"} aria-hidden={p.id !== page}>
            {p.body}
          </p>
        ))}
      </div>
    </div>
  );
}

/** The Audio guide, "Install to my panel": the way to the edition shelf, in a tab of its own. */
function EditionsLink({ lang }: { lang: GuideLang }) {
  const { label, href } = AUDIO_COPY[lang].ui.editions;
  return (
    <div className={styles.extra}>
      <Link href={href} className={styles.nextLink} target="_blank" rel="noopener">
        {label}
        <span aria-hidden="true">↗</span>
      </Link>
    </div>
  );
}

/**
 * The extra a step's copy names (copy.ts `extra`), inside that step's card.
 * `step` is the step's index in its chapter, for an extra that more than one
 * step uses and shows something different in each.
 */
export default function Extras({ kind, lang, step }: { kind: Extra; lang: GuideLang; step: number }) {
  // The build page's cards (build/BuildCards.tsx): the parts list, the
  // terminals' polarity, the checklists, the way to Play's flashing.
  if (kind.startsWith("build:")) return <BuildCards card={kind.slice(6) as BuildCard} lang={lang} step={step} />;
  // The audio page's captures and photos (AudioShots.tsx), a set a step.
  if (kind.startsWith("audioShots:")) return <AudioShots set={kind.slice(11) as AudioShotSet} lang={lang} step={step} />;
  switch (kind) {
    case "flashButton":
      return <FlashBlock lang={lang} />;
    case "bootSeq":
      return <BootSeq lang={lang} />;
    case "wifiShots":
      return <WifiShots lang={lang} />;
    case "deckFan":
      return <DeckFan lang={lang} />;
    case "installFlow":
      return <InstallFlow lang={lang} />;
    case "consoleDesktop":
      return <ConsoleWindow variant="desktop" lang={lang} />;
    case "consolePhone":
      return <ConsoleWindow variant="phone" lang={lang} />;
    case "consoleTour":
      return <ConsoleTour lang={lang} />;
    // The make page: 01 Community and 02 Pattern Lab. On a screen with the
    // desk (desk/DeskStage) the real thing is beside the card, so these —
    // screenshots, and the Lab in a tab — are for screens without it
    // (Guide.module.css .offDesk).
    case "communityShots":
      return (
        <div className={styles.offDesk}>
          <CommunityShots lang={lang} step={step} />
        </div>
      );
    case "labShots":
      return (
        <div className={styles.offDesk}>
          <LabShots lang={lang} step={step} />
        </div>
      );
    case "labWindow":
      return (
        <div className={styles.offDesk}>
          <LabWindow lang={lang} step={step} />
        </div>
      );
    // The audio page: the way to the edition shelf, and the extension's
    // real editor driving the board on the stage (EditorWindow.tsx).
    case "editionsLink":
      return <EditionsLink lang={lang} />;
    case "editorLive":
      return <EditorWindow lang={lang} step={step} />;
  }
}
