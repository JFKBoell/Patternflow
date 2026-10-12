import type { GuideLang, GuidePageId, GuideScreen } from "./store";
import type { ConsolePage } from "./ConsoleWindow";
import type { BuildCard } from "./build/cards";

// Every word the Play guide says (/guide/play), in both languages. Scenes
// and steps line up with SCENES in scenes.ts one-to-one: step N of a scene's
// copy is shown while step N of its script is on stage. The other guides'
// words are in copy/: build.ts for Build; make.ts for Make, with
// community.ts and lab.ts for its chapters; hub.ts for /guide itself. The
// types and `ui` here are shared by all of them.

export type Extra =
  | "flashButton"
  | "bootSeq"
  | "wifiShots"
  | "deckFan"
  | "installFlow"
  | "consoleDesktop"
  | "consolePhone"
  | "consoleTour"
  // The make page (copy/community.ts, copy/lab.ts): CommunityShots.tsx,
  // LabShots.tsx, LabWindow.tsx.
  | "communityShots"
  | "labShots"
  | "labWindow"
  // The build page (copy/build.ts): build/BuildCards.tsx.
  | `build:${BuildCard}`
  // The audio page (copy/audio.ts): the way to the edition shelf
  // (Extras.tsx), the extension's real editor in its demo mode, driving the
  // board on the stage (EditorWindow.tsx), and real captures and photos, a
  // set a step (AudioShots.tsx).
  | "editionsLink"
  | "editorLive"
  | `audioShots:${AudioShotSet}`;

/**
 * The Audio guide's captures and photos, a set a step (AudioShots.tsx): the
 * extension's popup, the two microphone photos, the console's Audio and MIDI
 * pages, rtpMIDI and Live.
 */
export type AudioShotSet =
  | "popup"
  | "popupStates"
  | "micPart"
  | "micWiring"
  | "micSeated"
  | "audioIn"
  | "audioInMap"
  | "audioInNoMic"
  | "rtpmidi"
  | "liveRemote"
  | "midiPage"
  | "midiSession";

export type StepCopy = {
  kicker: string;
  title: string;
  body: string[];
  /** The maker, aside. */
  note?: string;
  /** A caution worth its own line. */
  warn?: string;
  extra?: Extra;
};

export type SceneCopy = {
  /**
   * "01": the chapter's place in its guide. The Audio guide's sections have
   * none — they are in no order — and wherever the number would stand (the
   * chapter's head, the rail, the opening's list, a "Stuck here?" issue)
   * there is nothing.
   */
  num?: string;
  title: string;
  lede: string;
  /**
   * The one thing the chapter needs first, as a link under its lede — the
   * Audio guide's sections each open cold, and say "Needs the Audio edition"
   * with the way to it (href: "#edition").
   */
  needs?: { label: string; href: string };
  steps: StepCopy[];
};

/** A page's first screen (pages.ts). */
export type OpeningCopy = {
  kicker: string;
  title: string;
  lede: string;
  scroll: string;
  /** The chapters' names, in order: the opening's list and the rail. */
  chapters: string[];
  /**
   * The Audio guide: the list in two groups, each under its label — the one
   * chapter that comes first (pages.ts PageChapter.first), then the rest, in
   * any order.
   */
  groups?: { first: string; rest: string };
  /** A quiet link to another page of the guide (or the hub), under the chapter list. */
  back?: { label: string; to: GuideScreen };
};

/** A page's last screen: what comes next. */
export type ClosingCopy = {
  title: string;
  lede: string;
  /**
   * The guides still to come. A group with `to` is a guide that exists: the
   * whole group links to that page. `later` sets a group as a list of names,
   * three across.
   */
  groups: { label: string; items: string[]; to?: GuidePageId; later?: boolean }[];
  until: string;
  links: { label: string; href: string }[];
  /** The end's "Stuck somewhere else?" issue: its title and where (default: ui.report's). */
  report?: { title: string; where: string };
};

export type GuideCopy = {
  meta: { title: string; description: string };
  /** The guide's name: in the hub, and where a "Stuck here?" issue says the reader was. */
  name: string;
  brand: string;
  /** The other language's name; where it goes is the page's (pages.ts). */
  langSwitch: { label: string };
  opening: OpeningCopy;
  flash: SceneCopy;
  knobs: SceneCopy;
  patterns: SceneCopy;
  console: SceneCopy;
  next: ClosingCopy;
  ui: {
    noteBy: string;
    /** The WIP chip's tooltip, beside the brand. */
    wip: string;
    /** The "Stuck here?" links (report.ts). */
    report: { step: string; hint: string; general: string; generalTitle: string; generalWhere: string };
    /** On a Build card: play the step's motion on the stage again. */
    replay: string;
    flashUnsupported: string;
    openDecks: string;
    deviceAddress: string;
    bootSteps: [string, string, string];
    /** The line under "Format pattern storage?" in the Patterns page's confirm. */
    install: { confirm: string };
    tourLabel: string;
    /** The tour's tabs: a console page each. */
    pages: { id: ConsolePage; title: string; body: string }[];
  };
};

const en: GuideCopy = {
  meta: {
    title: "How to play Patternflow",
    description:
      "From a bare ESP32 to patterns on your panel: flashing, the four knobs, installing patterns and the device's own console — shown on a Patternflow you can turn.",
  },
  name: "Play",
  brand: "Patternflow",
  langSwitch: { label: "한국어" },
  opening: {
    kicker: "The guide · Play",
    title: "How to play it.",
    lede: "Four knobs, one panel of light. From the moment it's in your hands to your own patterns running on it — and the device on this page turns, presses and holds exactly like yours.",
    scroll: "Scroll",
    chapters: ["Flash", "Knobs", "Patterns", "Console"],
    back: { label: "All guides", to: "hub" },
  },
  flash: {
    num: "01",
    title: "Give it a brain",
    lede: "Once, the first time: download mode, the firmware, then your Wi-Fi — which usually takes a second go.",
    steps: [
      {
        kicker: "The ESP32",
        title: "Everything runs on one small board.",
        body: [
          "Patternflow's brain is an ESP32-S3 module, seated in sockets on the board inside. Slide the back cover off sideways, then lift the module out — gently, straight up.",
        ],
        note: "Built it yourself and haven't seated it yet? Even better. Skip ahead.",
      },
      {
        kicker: "Hold it like this",
        title: "Antenna up, ports toward you.",
        body: [
          "The module at the top, its antenna end up; the two USB-C ports at the bottom. Which way you hold it matters for the next step.",
        ],
      },
      {
        kicker: "The left port",
        title: "Plug into the LEFT one.",
        body: [
          "Use the left port, labelled USB, with a USB-C cable that carries data, and plug the other end into your computer.",
          "The right one (UART) is for Arduino IDE. The browser can flash through it, but it can't set up Wi-Fi there.",
        ],
        warn: "Nothing shows up at all? It's almost always a charge-only cable. Try another one first.",
      },
      {
        kicker: "Download mode",
        title: "Hold BOOT, tap RST, let go.",
        body: [
          "Every first flash starts here, before you press anything on this page. Press and hold BOOT, tap RST, then let go of BOOT. The board now waits for its firmware.",
        ],
        warn: "In download mode the flasher can't tell it's already Patternflow, so it erases it — installed patterns and saved Wi-Fi too. Fine on a new build. A board already running Patternflow updates over Wi-Fi instead, from its console's Update page.",
        extra: "bootSeq",
      },
      {
        kicker: "Flash",
        title: "Flash Patternflow.",
        body: [
          "In desktop Chrome or Edge, press Flash Patternflow below and pick USB JTAG/serial debug unit. The dialog walks you through the rest; its screens are under the button. About two minutes.",
          "Not in the list? Hold BOOT, tap RST again, then press the button again.",
        ],
        extra: "flashButton",
      },
      {
        kicker: "Wi-Fi",
        title: "Press RST. Then the Wi-Fi.",
        body: [
          "Usually the dialog ends without asking for your Wi-Fi. That's normal, nothing failed: the board just hasn't restarted into Patternflow yet.",
          "Close the dialog, press RST once, then press Flash Patternflow below and pick the port again. This time it opens on Patternflow's own menu instead of installing: choose Connect to Wi-Fi, type your network's name exactly — capitals count — and its password, and Connect.",
        ],
        warn: "2.4 GHz only: the ESP32 can't see 5 GHz. Still won't join? Carry on: this chapter's last card does it from a phone.",
        extra: "wifiShots",
      },
      {
        kicker: "Power",
        title: "Back in. Power on.",
        body: [
          "Unplug the USB cable. Seat the ESP32 back in its sockets the way the silkscreen shows, slide the back cover on, and plug Patternflow's power cable into a power bank.",
          "Power always goes in through that cable — never through the ESP32's USB ports.",
        ],
        note: "A red, squarish pattern comes on. That's Origin: the first pattern I ever made.",
      },
      {
        kicker: "Still no Wi-Fi?",
        title: "The panel is a network itself.",
        body: [
          "Hold K2, the top-left knob, for a second. CONNECTED and an address: it's on your Wi-Fi, carry on. HOTSPOT and a name like patternflow-a1b2, over two lines: it found no network it knows, so it became one.",
          "Join that network from a phone or laptop — the password is patternflow — and open http://192.168.4.1/. The phone will say there's no internet: true, and it stays connected.",
          "On the Wi-Fi page, pick your network from the ones the panel found, add its password, and Save. The panel's screen then shows JOINED and its new address, or why it couldn't.",
        ],
        warn: "Neither on K2 yet, or not in your phone's list? The hotspot only comes up about 15 seconds after power-on. Wait, refresh the list (or switch Wi-Fi off and on), and look for the exact name K2 shows.",
      },
    ],
  },
  knobs: {
    num: "02",
    title: "Four knobs",
    lede: "Turn, press, hold. That's the whole instrument.",
    steps: [
      {
        kicker: "The numbers",
        title: "They start at the top right.",
        body: ["K1 top right, K2 top left, K3 bottom right, K4 bottom left. Not the order you'd guess."],
        note: "Why the top right? Think about how it was built. I didn't plan it — and never got round to changing it.",
      },
      {
        kicker: "Turn",
        title: "Turning belongs to the pattern.",
        body: [
          "Each knob moves whatever the running pattern gives it. On Origin: K1 colour, K2 speed, K3 the tiling, K4 the wave's frequency.",
          "Every pattern decides its own four. That's the point.",
          "The one here plays like yours: take the orange dot on a knob's ring and drive it round — beside the knob you'll see what that knob is and where it is. Click to press, hold a second for its screen.",
        ],
      },
      {
        kicker: "Press",
        title: "So does a short press.",
        body: [
          "A click goes to the pattern too. On Origin it zeroes that knob: K1 back to red, K2 stops the motion, K3 back to the first tiling, K4 to its lowest frequency.",
        ],
      },
      {
        kicker: "Hold K1",
        title: "Brightness.",
        body: [
          "Hold any knob for a second and the device takes over from the pattern. K1 is brightness: turn K1 to set it, then press K1 — or just wait five seconds.",
        ],
      },
      {
        kicker: "Hold K2",
        title: "The network.",
        body: [
          "K2 shows the Wi-Fi state and the board's IP address, split over two lines. Remember where it is: it's how your phone finds the board.",
          "Turning K1 here puts the panel to sleep. Any knob wakes it.",
        ],
      },
      {
        kicker: "Hold K3",
        title: "Which knob is which.",
        body: ["K3 puts every knob's number on the panel, and the one you're turning lights up in orange."],
      },
      {
        kicker: "Hold K4",
        title: "Patterns.",
        body: [
          "K4 opens the pattern list. Turn K4 to move — three clicks per pattern — and it loads when you stop. Hold K4 again to close it.",
          "Right now it says 1 / 1. That's next.",
        ],
      },
    ],
  },
  patterns: {
    num: "03",
    title: "More patterns",
    lede: "Patterns are small files. They arrive over Wi-Fi — no cable, no reflashing.",
    steps: [
      {
        kicker: "1 / 1",
        title: "A new board has one pattern.",
        body: [
          "Origin is built into the firmware, so a board can always boot into something. Everything else lives on the board's storage and installs in seconds.",
        ],
      },
      {
        kicker: "Basics",
        title: "Let's put the Basics deck on.",
        body: [
          "The community has patterns one by one, and decks — a set of them, like a hand of cards. Basics is the deck made for a new board: 33 patterns, no account needed.",
          "A single pattern goes on the same way, from its own page (Send to my Patternflow). And you can make a deck of your own and share it.",
        ],
        extra: "deckFan",
      },
      {
        kicker: "Install",
        title: "Install to my board.",
        body: [
          "On the Basics card, press Install to my board. Your browser opens the board's own page and hands it the whole pack over your Wi-Fi — the board never goes on the internet itself.",
          "The first time, it asks to format its storage. Press Format storage, confirm, and the pack installs by itself, file by file. It takes under a minute.",
        ],
        warn: "Android can't open patternflow.local. Hold K2 and type the IP address into Device address on the card first.",
        extra: "installFlow",
      },
      {
        kicker: "1 / 34",
        title: "Hold K4 again.",
        body: ["Origin and the 33 Basics. Turn K4 to browse, stop to play, hold to close."],
        note: "Some of these are the very first ones — a little old-fashioned. I like them anyway.",
      },
    ],
  },
  console: {
    num: "04",
    title: "The console",
    lede: "The board serves its own web page. Every setting it has lives there.",
    steps: [
      {
        kicker: "patternflow.local",
        title: "Open it in a browser.",
        body: [
          "On a computer on the same Wi-Fi, go to patternflow.local. What's playing, brightness, sleep, the four knobs as sliders — and a page for everything else.",
          "The one below is live. Open it, step through patterns with the arrows by Now playing or slide a knob, and watch the panel follow.",
        ],
        extra: "consoleDesktop",
      },
      {
        kicker: "On a phone",
        title: "Use the address on K2.",
        body: [
          "Phones — Android especially — often can't find patternflow.local. Hold K2 and type the IP address it shows. On Windows, http://patternflow/ works too.",
          "Same console, phone-sized. Try it here too.",
        ],
        extra: "consolePhone",
      },
      {
        kicker: "Inside",
        title: "What's in it.",
        body: [
          "Patterns to install, delete or download. Up to five Wi-Fi networks, the latest first unless you pick one. Which way each knob counts. And new firmware, over Wi-Fi, with your patterns kept.",
        ],
        extra: "consoleTour",
      },
    ],
  },
  next: {
    title: "Next: make your own.",
    lede: "That was the first hour. The next guide is about making: finding what other people made, and making your own.",
    groups: [
      { label: "The next guide", items: ["Community — patterns and decks", "Pattern Lab — layers, Graphic Export, Director"], to: "make" },
      { label: "The Audio guide", items: ["A browser tab, the microphone, MIDI & your DAW"], to: "audio" },
      { label: "After that", items: ["Editions", "MQTT", "Clock", "Performance"], later: true },
    ],
    until: "Until they're here, the real things:",
    links: [
      { label: "Pattern Lab", href: "/pattern-lab" },
      { label: "Community", href: "https://community.patternflow.work/community" },
      { label: "Editions", href: "/editions" },
      { label: "Features", href: "/features" },
    ],
    report: { title: "stuck", where: "The Play guide, somewhere not listed" },
  },
  ui: {
    noteBy: "From the maker",
    wip: "Work in progress: this guide is still being written and will keep changing",
    report: {
      step: "Stuck here? Tell us",
      hint: "Opens a GitHub issue with this step already filled in",
      general: "Stuck somewhere else? Tell us",
      generalTitle: "stuck",
      generalWhere: "The guide, somewhere not listed",
    },
    replay: "Replay",
    flashUnsupported: "Flashing works in desktop Chrome or Edge.",
    openDecks: "Open the decks",
    deviceAddress: "Device address",
    bootSteps: ["Hold BOOT", "Tap RST", "Release BOOT"],
    install: { confirm: "This writes a fresh filesystem to the pattern partition. … On a new board there is nothing there to lose." },
    tourLabel: "Console pages",
    pages: [
      { id: "patterns", title: "Patterns", body: "Click a name to play it. Install, delete, download as a ZIP, and set the order." },
      { id: "wifi", title: "Wi-Fi", body: "Up to five networks, and which one to try first." },
      { id: "knobs", title: "Knobs", body: "Each knob's direction, and how far one click goes." },
      { id: "update", title: "Update", body: "New firmware over Wi-Fi. Your patterns stay." },
    ],
  },
};

const ko: GuideCopy = {
  meta: {
    title: "패턴플로우 사용법",
    description:
      "빈 ESP32에서 내 패널 위의 패턴까지. 펌웨어 굽기, 네 개의 노브, 패턴 설치, 기기의 웹 콘솔을 직접 돌려볼 수 있는 패턴플로우로 보여줍니다.",
  },
  name: "연주",
  brand: "Patternflow",
  langSwitch: { label: "English" },
  opening: {
    kicker: "가이드 · 연주",
    title: "이렇게 연주해요.",
    lede: "노브 네 개, 빛의 패널 하나. 손에 들어온 순간부터 내 패턴이 돌아가기까지. 이 페이지의 패턴플로우는 진짜와 똑같이 돌고, 눌리고, 꾹 눌려요.",
    scroll: "스크롤",
    chapters: ["굽기", "노브", "패턴", "콘솔"],
    back: { label: "가이드 전체", to: "hub" },
  },
  flash: {
    num: "01",
    title: "두뇌 깨우기",
    lede: "처음 한 번만. 다운로드 모드로 펌웨어를 굽고, 와이파이를 넣어요. 와이파이는 보통 두 번째에 돼요.",
    steps: [
      {
        kicker: "ESP32",
        title: "모든 건 작은 보드 하나에서 돌아가요.",
        body: [
          "패턴플로우의 두뇌는 ESP32-S3 모듈이에요. 안쪽 기판의 소켓에 꽂혀 있어요. 뒷면 덮개를 옆으로 밀어 빼고, 모듈을 살살 곧게 들어 올려요.",
        ],
        note: "직접 만들고 있는데 아직 안 꽂았다면? 오히려 좋다. 바로 다음으로.",
      },
      {
        kicker: "이렇게 들어요",
        title: "안테나는 위로, 포트는 내 쪽으로.",
        body: ["모듈의 안테나 끝이 위로, USB-C 포트 두 개가 아래로 오게 잡아요. 다음 단계에서 방향이 중요해요."],
      },
      {
        kicker: "왼쪽 포트",
        title: "왼쪽에 꽂아요.",
        body: [
          "USB라고 적힌 왼쪽 포트에 데이터가 되는 USB-C 케이블을 꽂고, 반대쪽은 컴퓨터에 연결해요.",
          "오른쪽(UART)은 아두이노 IDE용이에요. 굽기는 되지만 와이파이 설정이 안 떠요.",
        ],
        warn: "아무것도 안 잡히면 거의 항상 충전 전용 케이블이에요. 케이블부터 바꿔 보세요.",
      },
      {
        kicker: "다운로드 모드",
        // "RST 한 번" stays on one line (no-break spaces): the title broke inside it.
        title: "BOOT 누른 채로, RST\u00a0한\u00a0번, BOOT 떼기.",
        body: [
          "처음 구울 땐 언제나 여기서 시작해요. 이 페이지에서 뭘 누르기 전에요. BOOT를 누른 채로 RST를 한 번 눌렀다 떼고, BOOT를 떼요. 이제 보드가 펌웨어를 기다려요.",
        ],
        warn: "다운로드 모드에선 플래셔가 이미 패턴플로우인지 몰라서 새 보드로 보고 지워요. 설치한 패턴과 저장된 와이파이까지요. 새로 만든 보드라면 괜찮아요. 이미 패턴플로우가 도는 보드는 대신 콘솔의 Update 페이지에서 와이파이로 업데이트해요.",
        extra: "bootSeq",
      },
      {
        kicker: "굽기",
        title: "‘Flash Patternflow’로 구워요.",
        body: [
          "데스크톱 크롬이나 엣지에서 아래 Flash Patternflow를 누르고 USB JTAG/serial debug unit을 골라요. 나머지는 창이 차례로 안내해요. 그 화면들은 버튼 아래에 순서대로 있어요. 2분쯤 걸려요.",
          "목록에 없으면 BOOT를 누른 채로 RST를 한 번 더 누르고, 버튼을 다시 눌러요.",
        ],
        extra: "flashButton",
      },
      {
        kicker: "와이파이",
        // "RST 한 번" on one line, as above.
        title: "RST\u00a0한\u00a0번, 그다음 와이파이.",
        body: [
          "보통은 창이 와이파이를 묻지 않고 끝나요. 정상이에요. 실패한 게 아니라, 보드가 아직 패턴플로우로 다시 켜지지 않았을 뿐이에요.",
          "창을 닫고 RST를 한 번 누른 뒤, 아래 Flash Patternflow를 다시 눌러 포트를 다시 골라요. 이번엔 설치 대신 패턴플로우의 메뉴가 열려요. Connect to Wi-Fi를 고르고, 네트워크 이름을 대소문자까지 정확히 치고 비밀번호를 넣은 뒤 Connect.",
        ],
        warn: "2.4 GHz만 돼요. ESP32는 5 GHz를 못 봐요. 그래도 안 붙으면 일단 넘어가요. 이 장의 마지막 카드에서 폰으로 할 수 있어요.",
        extra: "wifiShots",
      },
      {
        kicker: "전원",
        title: "다시 꽂고, 전원.",
        body: [
          "USB 케이블을 빼요. ESP32를 실크 인쇄 방향대로 소켓에 다시 꽂고, 뒷면 덮개를 밀어 닫고, 패턴플로우 전원 케이블을 보조배터리에 연결해요.",
          "전원은 언제나 그 케이블로만 들어가요. ESP32의 USB 포트로 넣지 않아요.",
        ],
        note: "빨간 네모네모한 패턴이 켜진다. Origin, 내가 처음 만든 패턴이다.",
      },
      {
        kicker: "아직 와이파이가 없다면",
        title: "패널이 직접 네트워크가 돼요.",
        body: [
          "K2(왼쪽 위 노브)를 1초 꾹 눌러요. CONNECTED와 주소가 보이면 와이파이에 붙은 거예요. 다음으로 가요. HOTSPOT과 patternflow-a1b2 같은 이름이 두 줄로 보이면, 아는 네트워크를 못 찾아서 패널이 직접 네트워크가 된 거예요.",
          "폰이나 노트북으로 그 네트워크에 접속하고(비밀번호는 patternflow) http://192.168.4.1/ 을 열어요. 폰이 인터넷이 없다고 할 거예요. 맞는 말이고, 연결은 그대로 유지돼요.",
          "Wi-Fi 페이지에서 패널이 찾은 네트워크 중 내 것을 고르고, 비밀번호를 넣은 뒤 Save. 패널 화면에 JOINED와 새 주소가 뜨거나, 안 된 이유가 떠요.",
        ],
        warn: "K2에 아직 둘 다 안 보이거나 폰 목록에 없나요? 핫스팟은 켜고 15초쯤 지나야 떠요. 기다렸다가 목록을 새로 고치거나 와이파이를 껐다 켜고, K2에 뜬 이름과 정확히 같은 걸 찾아요.",
      },
    ],
  },
  knobs: {
    num: "02",
    title: "노브 네 개",
    lede: "돌리고, 누르고, 꾹. 악기는 그게 전부예요.",
    steps: [
      {
        kicker: "번호",
        title: "오른쪽 위부터 시작해요.",
        body: ["K1 오른쪽 위, K2 왼쪽 위, K3 오른쪽 아래, K4 왼쪽 아래. 예상과 다르죠."],
        note: "왜 오른쪽 위부터냐고? 만들 때를 떠올려 보면 알 수 있다. 의도한 건 아니다. 고치기 귀찮아서 그냥 두었다. 추리해 보도록!",
      },
      {
        kicker: "돌리기",
        title: "돌리는 건 패턴 몫이에요.",
        body: [
          "노브는 지금 돌아가는 패턴이 맡긴 걸 움직여요. Origin에선 K1 색, K2 속도, K3 타일 배치, K4 물결의 촘촘함.",
          "패턴마다 네 개를 다르게 써요. 그게 핵심이에요.",
          "여기 있는 것도 진짜처럼 돌아가요. 노브 둘레의 주황 점을 잡고 빙 돌려 보세요. 옆에 그 노브가 무엇을 얼마나 움직이는지 떠요. 클릭은 누르기, 1초 꾹 누르면 그 노브의 화면이 열려요.",
        ],
      },
      {
        kicker: "누르기",
        title: "짧게 누르는 것도요.",
        body: ["클릭도 패턴에게 가요. Origin에선 그 노브를 0으로 돌려요. K1은 빨강으로, K2는 멈추고, K3는 첫 타일 배치로, K4는 가장 낮은 주파수로."],
      },
      {
        kicker: "K1 꾹",
        title: "밝기.",
        body: ["아무 노브나 1초 꾹 누르면 기기가 패턴한테서 넘겨받아요. K1은 밝기. K1을 돌려 맞추고 K1을 누르거나, 5초 기다리면 돌아와요."],
      },
      {
        kicker: "K2 꾹",
        title: "네트워크.",
        body: [
          "K2는 와이파이 상태와 보드의 IP 주소를 두 줄에 나눠 보여줘요. 기억해 두세요. 폰이 보드를 찾는 방법이에요.",
          "여기서 K1을 돌리면 패널이 잠들어요. 아무 노브나 돌리면 깨요.",
        ],
      },
      {
        kicker: "K3 꾹",
        title: "어느 노브가 몇 번인지.",
        body: ["K3는 노브마다 번호를 패널에 띄워요. 지금 돌리는 노브의 번호가 패널에서 주황색으로 켜져요."],
      },
      {
        kicker: "K4 꾹",
        title: "패턴.",
        body: [
          "K4는 패턴 목록을 열어요. K4를 돌려 이동하고(패턴 하나에 세 칸), 멈추면 그 패턴이 켜져요. K4를 다시 꾹 누르면 닫혀요.",
          "지금은 1 / 1이에요. 그게 다음 이야기예요.",
        ],
      },
    ],
  },
  patterns: {
    num: "03",
    title: "패턴 더 넣기",
    lede: "패턴은 작은 파일이에요. 와이파이로 들어와요. 케이블도, 다시 굽기도 없이.",
    steps: [
      {
        kicker: "1 / 1",
        title: "새 보드엔 패턴이 하나예요.",
        body: ["Origin은 펌웨어에 들어 있어서, 보드가 언제나 뭔가로는 켜질 수 있어요. 나머지는 보드 저장공간에 살고 몇 초면 설치돼요."],
      },
      {
        kicker: "Basics",
        title: "Basics 덱을 올려 봐요.",
        body: [
          "커뮤니티엔 패턴 하나하나와, 여러 개를 카드 패처럼 묶은 덱이 있어요. Basics는 새 보드를 위한 덱이에요. 패턴 33개, 계정도 필요 없어요.",
          "패턴 하나만 올리는 것도 같아요. 그 패턴 페이지에서 Send to my Patternflow를 누르면 돼요. 내 덱을 만들어 공유할 수도 있어요.",
        ],
        extra: "deckFan",
      },
      {
        kicker: "설치",
        title: "‘Install to my board’를 눌러요.",
        body: [
          "Basics 카드에서 Install to my board를 눌러요. 브라우저가 보드의 페이지를 열고 팩 전체를 와이파이로 넘겨줘요. 보드는 인터넷에 직접 나가지 않아요.",
          "처음엔 저장공간을 포맷하라고 해요. Format storage를 누르고 확인하면 팩이 파일 하나씩 알아서 설치돼요. 1분이 안 걸려요.",
        ],
        warn: "안드로이드는 patternflow.local을 못 열어요. K2를 꾹 눌러 나온 IP 주소를 카드의 Device address에 먼저 넣어요.",
        extra: "installFlow",
      },
      {
        kicker: "1 / 34",
        title: "K4를 다시 꾹.",
        body: ["Origin에 Basics 33개. K4를 돌려 넘기고, 멈추면 재생, 꾹 누르면 닫혀요."],
        note: "아주 초기 패턴들이라 좀 촌스러운 것도 있다. 그래도 나는 좋다.",
      },
    ],
  },
  console: {
    num: "04",
    title: "웹 콘솔",
    lede: "보드가 자기 웹페이지를 띄워요. 기기의 모든 설정이 거기 있어요.",
    steps: [
      {
        kicker: "patternflow.local",
        title: "브라우저로 열어요.",
        body: [
          "같은 와이파이의 컴퓨터에서 patternflow.local로 가요. 지금 재생 중인 패턴, 밝기, 잠자기, 슬라이더로 된 노브 네 개. 나머지는 페이지마다 따로 있어요.",
          "아래 창은 진짜로 움직여요. 열어서 Now playing 옆 화살표로 패턴을 넘기거나 노브 슬라이더를 밀어 보세요. 패널이 따라 바뀌어요.",
        ],
        extra: "consoleDesktop",
      },
      {
        kicker: "폰에서",
        title: "K2의 주소를 써요.",
        body: [
          "폰, 특히 안드로이드는 patternflow.local을 못 찾을 때가 많아요. K2를 꾹 눌러 나온 IP 주소를 치면 돼요. 윈도우에선 http://patternflow/ 도 돼요.",
          "같은 콘솔, 폰 크기예요. 여기서도 눌러 보세요.",
        ],
        extra: "consolePhone",
      },
      {
        kicker: "안에는",
        title: "이런 게 있어요.",
        body: ["패턴 설치·삭제·다운로드. 와이파이는 다섯 개까지, 따로 고르지 않으면 최근 것부터 시도해요. 노브마다 도는 방향. 그리고 와이파이로 받는 새 펌웨어. 패턴은 그대로 남아요."],
        extra: "consoleTour",
      },
    ],
  },
  next: {
    title: "다음: 내 패턴 만들기.",
    lede: "여기까지가 처음 한 시간이에요. 다음 가이드는 만드는 이야기예요. 남들이 만든 걸 찾고, 내 걸 만들어요.",
    groups: [
      { label: "다음 가이드", items: ["커뮤니티 — 패턴과 덱", "패턴 랩 — 레이어, 그래픽 익스포트, 디렉터"], to: "make" },
      { label: "오디오 가이드", items: ["브라우저 탭 소리, 마이크, MIDI와 DAW"], to: "audio" },
      { label: "그다음", items: ["에디션", "MQTT", "시계", "퍼포먼스"], later: true },
    ],
    until: "그동안은 바로 가서 해 봐도 돼요.",
    links: [
      { label: "Pattern Lab", href: "/pattern-lab" },
      { label: "Community", href: "https://community.patternflow.work/community" },
      { label: "Editions", href: "/editions" },
      { label: "Features", href: "/features" },
    ],
    report: { title: "stuck", where: "연주 가이드 어딘가 (단계 없음)" },
  },
  ui: {
    noteBy: "만든 사람의 한마디",
    wip: "작업 중이에요. 가이드는 아직 쓰는 중이라 계속 바뀌어요",
    report: {
      step: "여기서 막혔나요? 알려 주세요",
      hint: "이 단계가 채워진 GitHub 이슈가 열려요",
      general: "다른 데서 막혔나요? 알려 주세요",
      generalTitle: "stuck",
      generalWhere: "가이드 어딘가 (단계 없음)",
    },
    replay: "다시 보기",
    flashUnsupported: "굽기는 데스크톱 크롬이나 엣지에서 돼요.",
    openDecks: "덱 열기",
    deviceAddress: "Device address",
    bootSteps: ["BOOT 누른 채로", "RST 한 번", "BOOT 떼기"],
    install: { confirm: "This writes a fresh filesystem to the pattern partition. … On a new board there is nothing there to lose." },
    tourLabel: "콘솔 페이지",
    pages: [
      { id: "patterns", title: "Patterns", body: "이름을 누르면 재생돼요. 설치, 삭제, ZIP으로 받기, 순서 바꾸기까지." },
      { id: "wifi", title: "Wi-Fi", body: "네트워크 다섯 개까지, 그리고 어느 걸 먼저 시도할지." },
      { id: "knobs", title: "Knobs", body: "노브마다 도는 방향과 한 칸의 크기." },
      { id: "update", title: "Update", body: "와이파이로 받는 새 펌웨어. 패턴은 그대로예요." },
    ],
  },
};

export const COPY: Record<GuideLang, GuideCopy> = { en, ko };
