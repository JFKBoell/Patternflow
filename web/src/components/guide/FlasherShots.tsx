"use client";

// The web flasher as it really looks: ESP Web Tools 10.4.0's own install
// dialog, captured screen by screen (web/public/guide/flasher/*.webp) with
// this site's manifest and the answers the Patternflow firmware really gives
// over Improv (firmware "Patternflow", version "3.10.4", ESP32-S3, an empty
// network scan). Nothing here is redrawn — if the library or the manifest
// changes, re-shoot the images rather than editing them.
//
// One screen at a time, stepping on its own only while it is on screen, never
// under the pointer or keyboard focus, and not at all for reduced motion.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useGuideStore, type GuideLang } from "./store";
import styles from "./FlasherShots.module.css";

export type FlasherSet = "install" | "wifi" | "dashboard";

type Shot = {
  /** File in /guide/flasher/, captured at 2x. */
  src: string;
  /** The dialog's size in CSS px (half the image). */
  w: number;
  h: number;
  /** The dialog's own wording, quoted as it appears (English in both languages). */
  title: string;
  en: string;
  ko: string;
  /** How long this screen stays up before the next one (ms). */
  ms?: number;
};

const BASE = "/guide/flasher/";
const STEP_MS = 2400;
const LAST_HOLD_MS = 1200;

// Three screens both ways to the Wi-Fi share: Patternflow sends no network
// list, the panel trying the network, and the end.
const SCANNING: Shot = {
  src: "wifi-scanning.webp",
  w: 280,
  h: 188,
  title: "Scanning for networks",
  en: "Patternflow doesn't send a network list, so this spins about ten seconds.",
  ko: "Patternflow는 주변 네트워크 목록을 보내지 않아서 10초쯤 돌아요.",
  ms: 2800,
};

const CONNECTING: Shot = {
  src: "wifi-connecting.webp",
  w: 280,
  h: 188,
  title: "Trying to connect",
  en: "The panel gives the network up to 30 seconds.",
  ko: "패널이 최대 30초 동안 접속을 시도해요.",
};

const CONNECTED: Shot = {
  src: "wifi-connected.webp",
  w: 280,
  h: 276,
  title: "Device connected to the network!",
  en: "Visit Device opens the panel's console at its new address.",
  ko: "Visit Device를 누르면 패널의 새 주소로 콘솔이 열려요.",
};

const SETS: Record<FlasherSet, Shot[]> = {
  install: [
    {
      src: "install-dashboard.webp",
      w: 280,
      h: 216,
      title: "Install Patternflow",
      en: "After you pick the port, the dialog opens here. Choose Install Patternflow.",
      ko: "포트를 고르면 이 창이 떠요. Install Patternflow를 누르세요.",
    },
    {
      src: "install-confirm.webp",
      w: 314,
      h: 228,
      title: "Confirm Installation",
      en: "A new install wipes the board first. Press Install.",
      ko: "새로 설치할 땐 보드를 먼저 싹 지워요. Install을 누르세요.",
      ms: 2800,
    },
    {
      src: "install-erasing.webp",
      w: 280,
      h: 188,
      title: "Erasing",
      en: "Clearing the whole flash. It can sit here a while.",
      ko: "플래시 전체를 지우는 중이에요. 여기서 좀 머물 수 있어요.",
    },
    {
      src: "install-writing.webp",
      w: 320,
      h: 248,
      title: "Installing",
      en: "Writing, with a percentage. Keep this tab in front.",
      ko: "퍼센트가 올라가요. 이 탭을 앞에 띄워 두세요.",
      ms: 2800,
    },
    {
      src: "install-wrapping.webp",
      w: 320,
      h: 248,
      title: "Wrapping up",
      en: "It waits up to 20 seconds for the new firmware to answer. From download mode it usually won't yet. Let it wait.",
      ko: "새 펌웨어가 대답하길 20초까지 기다려요. 다운로드 모드로 구웠다면 보통 아직 대답이 없어요. 그냥 기다려요.",
    },
    {
      src: "install-complete.webp",
      w: 280,
      h: 212,
      title: "Installation complete!",
      en: "The firmware is on. Press Next. If no Wi-Fi follows — usually it doesn't — close the dialog. That's normal: the next card is for exactly this.",
      ko: "펌웨어가 들어갔어요. Next를 눌러요. 와이파이가 안 나오면(보통 안 나와요) 창을 닫아요. 정상이에요. 바로 다음 카드가 그 이야기예요.",
    },
  ],
  // The usual way: RST, then the flasher again, which now finds Patternflow running.
  dashboard: [
    {
      src: "dashboard.webp",
      w: 280,
      h: 344,
      title: "Connect to Wi-Fi",
      en: "After RST, press Flash Patternflow and pick the port again: now it opens on Patternflow's own menu. Choose Connect to Wi-Fi.",
      ko: "RST 다음 Flash Patternflow를 다시 눌러 포트를 고르면, 이번엔 패턴플로우의 메뉴가 열려요. Connect to Wi-Fi를 골라요.",
      ms: 3600,
    },
    SCANNING,
    {
      src: "dashboard-wifi-form.webp",
      w: 368,
      h: 404,
      title: "Configure Wi-Fi",
      en: "Leave Join other…, type the network name exactly (capitals count, 2.4 GHz only), the password, then Connect.",
      ko: "Join other…는 그대로 두고, 네트워크 이름을 대소문자까지 정확히(2.4 GHz만 돼요) 적고 비밀번호를 넣은 뒤 Connect.",
      ms: 3600,
    },
    CONNECTING,
    CONNECTED,
  ],
  // The lucky case: the board restarted on its own, and Next went straight on to Wi-Fi.
  wifi: [
    {
      src: "install-complete.webp",
      w: 280,
      h: 212,
      title: "Installation complete!",
      en: "Sometimes the board restarts by itself and Next goes straight on to Wi-Fi. Then there's no RST to press: fill it in right there.",
      ko: "가끔은 보드가 알아서 다시 켜져서 Next가 바로 와이파이로 넘어가요. 그럴 땐 RST 없이 거기서 바로 채워요.",
      ms: 3200,
    },
    SCANNING,
    {
      src: "wifi-form.webp",
      w: 368,
      h: 404,
      title: "Configure Wi-Fi",
      en: "The same form, straight after the install: fill it in the same way. Here the left button reads Skip, not Back.",
      ko: "설치 바로 다음에 뜨는 같은 입력 칸이에요. 똑같이 채워요. 여기선 왼쪽 버튼이 Back 대신 Skip이에요.",
      ms: 3200,
    },
    CONNECTING,
    CONNECTED,
  ],
};

const UI = {
  en: { label: "ESP Web Tools, screen by screen", step: "Screen", sets: "Which flasher screens" },
  ko: { label: "ESP Web Tools 화면 순서", step: "화면", sets: "플래셔 화면 고르기" },
} as const;

// A viewer can hold more than one sequence (the Wi-Fi card: the usual way,
// after RST, then the lucky one, straight after the install), picked with a
// pair of tabs above the frame.
const SET_LABEL: Record<FlasherSet, Record<GuideLang, string>> = {
  install: { en: "Install", ko: "설치" },
  dashboard: { en: "Usually: after RST", ko: "보통: RST 다음" },
  wifi: { en: "Sometimes: right away", ko: "가끔: 설치 바로 다음" },
};

// Space around the dialog inside the frame, in the dialog's CSS px.
const PAD = 14;
const MAX_VH = 33;
// On a phone the card sits under the stage and has to leave it room: the
// screens are pictures, the captions under them carry the words.
const MAX_VH_NARROW = 27;

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// On the server nothing moves; the client decides after hydration.
const getReducedMotionServer = () => true;

export default function FlasherShots({
  set,
  lang,
  waitForKit = false,
}: {
  set: FlasherSet | FlasherSet[];
  lang: GuideLang;
  /**
   * Hold the first screen until the DevKit on stage is held up in front of
   * the reader: arriving from far away (scrolling back up), it is still on
   * its way, and the screens would run ahead of the board they are about.
   */
  waitForKit?: boolean;
}) {
  const sets = Array.isArray(set) ? set : [set];
  const [which, setWhich] = useState(0);
  const current = sets[Math.min(which, sets.length - 1)];
  const shots = SETS[current];
  const n = shots.length;
  const ui = UI[lang];
  // Every screen of every sequence, once each (the success screen is shared),
  // so switching tabs shows images that are already decoded.
  const every = sets.flatMap((k) => SETS[k]).filter((s, i, all) => all.findIndex((o) => o.src === s.src) === i);

  const rootRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getReducedMotionServer);

  const active = index % n;
  const kitHere = useGuideStore((s) => s.kitPresented);
  const running = visible && !hovered && !focused && !reduced && (!waitForKit || kitHere);

  // Tell the stage which screen is up while this viewer is on screen.
  const setKey = sets.join(",");
  useEffect(() => {
    const store = useGuideStore.getState();
    if (visible) store.setFlasher({ set: current, index: active });
    else if (store.flasher && setKey.split(",").includes(store.flasher.set)) store.setFlasher(null);
  }, [visible, current, active, setKey]);
  useEffect(
    () => () => {
      const store = useGuideStore.getState();
      if (store.flasher && setKey.split(",").includes(store.flasher.set)) store.setFlasher(null);
    },
    [setKey],
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    // Out of view, it goes back to its first screen, so a reader who comes
    // to it sees the sequence from the start and not from wherever it was.
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.35);
        if (!entry.isIntersecting) {
          setIndex(0);
          setWhich(0);
        }
      },
      { threshold: [0, 0.35] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // One timeout per screen, so a click restarts the clock on the new screen.
  // With more than one sequence, the end of one plays on into the next tab,
  // so a reader who never clicks still sees both.
  const setCount = sets.length;
  useEffect(() => {
    if (!running) return;
    const shot = shots[active];
    const ms = (shot.ms ?? STEP_MS) + (active === n - 1 ? LAST_HOLD_MS : 0);
    const t = window.setTimeout(() => {
      if (active === n - 1 && setCount > 1) {
        setWhich((w) => (w + 1) % setCount);
        setIndex(0);
      } else setIndex((i) => (i + 1) % n);
    }, ms);
    return () => window.clearTimeout(t);
  }, [running, active, n, shots, setCount]);

  const onBlur = useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  }, []);

  // The frame is sized for the largest screen of the set, and every screen
  // is drawn at the same scale, so a small dialog looks small — as it does.
  // Across every sequence, so switching tabs doesn't resize the card.
  const unitW = Math.max(...every.map((s) => s.w)) + PAD * 2;
  const unitH = Math.max(...every.map((s) => s.h)) + PAD * 2;
  const onSrc = shots[active].src;

  return (
    <figure
      ref={rootRef}
      className={styles.shots}
      aria-label={ui.label}
      data-reduced={reduced ? "1" : "0"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
    >
      {sets.length > 1 && (
        <div className={styles.sets} role="group" aria-label={ui.sets}>
          {sets.map((k, i) => (
            <button
              key={k}
              type="button"
              className={styles.setTab}
              aria-pressed={k === current}
              onClick={() => {
                setWhich(i);
                setIndex(0);
              }}
            >
              {SET_LABEL[k][lang]}
            </button>
          ))}
        </div>
      )}
      <div
        className={styles.frame}
        // On a wide screen, never taller than MAX_VH of it: the tall Wi-Fi
        // form would push its card past the viewport (FlasherShots.module.css).
        style={
          {
            aspectRatio: `${unitW} / ${unitH}`,
            "--cap": `${((unitW / unitH) * MAX_VH).toFixed(2)}vh`,
            "--cap-narrow": `${((unitW / unitH) * MAX_VH_NARROW).toFixed(2)}vh`,
          } as React.CSSProperties
        }
      >
        {every.map((s) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.src}
            src={BASE + s.src}
            width={s.w}
            height={s.h}
            alt={s.src === onSrc ? s.title : ""}
            aria-hidden={s.src === onSrc ? undefined : true}
            decoding="async"
            draggable={false}
            className={styles.shot}
            data-on={s.src === onSrc ? "1" : "0"}
            style={{ width: `${(s.w / unitW) * 100}%` }}
          />
        ))}
      </div>

      <figcaption className={styles.caption}>
        <div className={styles.dots} role="group" aria-label={ui.label}>
          {shots.map((s, i) => (
            <button
              key={`${current}:${s.src}`}
              type="button"
              className={styles.dot}
              data-on={i === active ? "1" : "0"}
              data-done={i < active ? "1" : "0"}
              aria-label={`${ui.step} ${i + 1}: ${s.title}`}
              aria-current={i === active ? "step" : undefined}
              onClick={() => setIndex(i)}
            >
              <span>{i + 1}</span>
            </button>
          ))}
          <span className={styles.count} aria-hidden="true">
            {active + 1} / {n}
          </span>
        </div>
        {/* Every caption of every sequence in one grid cell: the block is as
            tall as the longest, whichever tab and screen is up. */}
        <div className={styles.texts} aria-live={running ? "off" : "polite"}>
          {sets.flatMap((k) =>
            SETS[k].map((s, i) => {
              const on = k === current && i === active;
              return (
                <p key={`${k}:${s.src}`} className={styles.text} data-on={on ? "1" : "0"} aria-hidden={on ? undefined : true}>
                  <b>{s.title}</b>
                  <span>{s[lang]}</span>
                </p>
              );
            }),
          )}
        </div>
      </figcaption>
    </figure>
  );
}
