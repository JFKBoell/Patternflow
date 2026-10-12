"use client";

/* eslint-disable react-hooks/immutability --
   Three.js objects are imperative; per-frame mutation is their API. */

import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { getSim, useGuideStore } from "../store";
import { stepOf } from "../scenes";
import { micPortStep } from "../scenes/audio";
import { bootPhase, kitState, RST_PULSE, rstPulseDown } from "../timing";
import { MODEL_OFFSET, MODEL_SCALE } from "./geometry";
import { kitPress } from "./hand";
import { stageAccent } from "./look/accent";
import { DEVKIT_PRESENT, DEVKIT_SEAT, KIT, M_TO_MODEL } from "./parts";
import { NO_POINTER, pillSize, placeTag, screenY, type TagSide } from "./tags";

// What happens on and around the ESP32 DevKit in chapter one: the USB-C
// cable going into the left port, the ports and buttons named, BOOT and RST
// pressed in order for download mode, data running up the cable while it
// flashes, RST pressed once more before the Wi-Fi and the Wi-Fi leaving the
// antenna, and — once it is back in the device — its hotspot, when the
// chapter's last card says the panel is a network itself. Mounted inside
// the DevKit's own group, so everything here is in its canonical frame
// (parts.ts): metres, +Y antenna, +Z toward the reader, USB-C ports at the
// −Y end.
//
// The cable only ever exists while the DevKit is held up in front of the
// reader, and the two take turns (timing.ts, kitState): it is brought up
// and plugged in once the DevKit has arrived, and before the DevKit goes
// anywhere the plug slides out of the port and the cable drops away —
// scenes.ts's stepOf keeps the DevKit where it is until then.

const LED = new THREE.Color("#ff6a3d");

/** The ports' tags hang off the middle of each port's mouth. */
const TAG_AT = {
  usb: new THREE.Vector3(KIT.usb.x, KIT.usb.y + 0.0036, KIT.usb.z),
  uart: new THREE.Vector3(KIT.uart.x, KIT.uart.y + 0.0036, KIT.uart.z),
};
/** Just past the right-hand pin header (pins at x 12.5 mm, the board's edge at 13.9). */
const PIN_ROW_X = 0.0142;

// kitState.cable: 0 gone, 1 hanging just below the port, 2 plugged in.
/** How far the plug comes out of the port before the cable drops (m). */
const UNPLUG = 0.012;
/** How far the plug and the hanging cable fall as it goes (m). */
const DROP = 0.07;
/** Seconds for the plug to slide in or out, and for the cable to come or go. */
const SLIDE_S = 0.5;
const COME_S = 0.45;

// Where the floor is, below the DevKit held up, in metres along world down
// from the DevKit's centre (the stage's floor is at world y −1.66).
const FLOOR_DROP = (DEVKIT_PRESENT.position.y * MODEL_SCALE + MODEL_OFFSET.y + 1.66) / (M_TO_MODEL * MODEL_SCALE);
const CABLE_R = 0.0021;
/** The DevKit's own light (candela; ~0.9 world units from the board it lights it about as the key light does). */
const KIT_LIGHT = 1.8;

function glowRing(radius: number) {
  const mat = new THREE.MeshBasicMaterial({ color: LED, transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
  return new THREE.Mesh(new THREE.RingGeometry(radius * 0.78, radius, 48), mat);
}

// Flashing: light sweeping down the module's shield, the chip being written.
// The shield is 15.8 x 17.4 mm (devkit.glb "module"), its top 3.6 mm up.
const SHIELD = { w: 0.0157, h: 0.0173, z: 0.00362 };
const sweepFrag = /* glsl */ `
uniform float uTime;
uniform float uFade;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  // A soft band running down the lid, a little under once a second, over a
  // faint warmth that stays; both die out toward the lid's edges.
  float ph = fract(uTime * 0.85);
  float band = exp(-pow((vUv.y - (1.1 - ph * 1.2)) / 0.09, 2.0));
  vec2 e = min(vUv, 1.0 - vUv);
  float edge = smoothstep(0.0, 0.12, min(e.x, e.y));
  float a = (band * 0.42 + 0.07) * edge * uFade;
  gl_FragColor = vec4(uColor * a, a);
}
`;
const sweepVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/**
 * The cable, built in "gravity" axes — world-aligned, metres, origin at the
 * DevKit's centre — so it hangs straight down whatever angle the DevKit is
 * held at, then turned into the DevKit's frame. From the plug it drops to the
 * floor and runs off along it toward the reader, bending in under the camera
 * (which stands a little left of the DevKit), so it leaves every DevKit shot
 * through the bottom edge; it is long enough that its far end is never seen.
 * Each vertex carries how much of the plug's motion it follows: all of it at
 * the plug, none where it lies on the floor.
 */
function buildCable() {
  const toG = DEVKIT_PRESENT.quaternion.clone();
  const toLocal = toG.clone().invert();
  const p = KIT.usb;
  // The bottom of the plug's overmould, in gravity axes.
  const exit = new THREE.Vector3(p.x, p.y - 0.0195, p.z).applyQuaternion(toG);
  // Straight out of the plug along its own axis first (strain relief).
  const relief = new THREE.Vector3(0, -0.014, 0).applyQuaternion(toG).add(exit);
  const floor = -FLOOR_DROP + CABLE_R;
  const pts = [
    exit,
    relief,
    new THREE.Vector3(exit.x + 0.002, exit.y - 0.05, exit.z + 0.006),
    new THREE.Vector3(exit.x + 0.004, floor + 0.022, exit.z + 0.03),
    new THREE.Vector3(exit.x + 0.006, floor + 0.001, exit.z + 0.075),
    new THREE.Vector3(exit.x + 0.004, floor, exit.z + 0.16),
    new THREE.Vector3(exit.x - 0.008, floor, exit.z + 0.36),
    new THREE.Vector3(exit.x - 0.024, floor, exit.z + 0.62),
    new THREE.Vector3(exit.x - 0.04, floor, exit.z + 0.95),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const segments = 260;
  const radial = 12;
  const geo = new THREE.TubeGeometry(curve, segments, CABLE_R, radial, false);
  const pos = geo.getAttribute("position");
  const follow = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const height = pos.getY(i) - floor;
    follow[i] = smooth((height - 0.008) / (relief.y - floor - 0.008));
  }
  geo.setAttribute("aFollow", new THREE.BufferAttribute(follow, 1));

  const mat = new THREE.MeshStandardMaterial({ color: "#e9e4da", roughness: 0.6, transparent: true });
  const uniforms = { uMove: { value: new THREE.Vector3() } };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMove = uniforms.uMove;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aFollow;\nuniform vec3 uMove;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed += uMove * aFollow;");
  };
  const tube = new THREE.Mesh(geo, mat);
  const g = new THREE.Group();
  g.quaternion.copy(toLocal);
  g.add(tube);

  // The plug: a soft overmould and the steel shell that goes in, on the
  // port's axis in the DevKit's own frame.
  const plugMat = new THREE.MeshStandardMaterial({ color: "#d9d4ca", roughness: 0.7, transparent: true });
  const tipMat = new THREE.MeshStandardMaterial({ color: "#c9ccd2", metalness: 0.9, roughness: 0.25, transparent: true });
  const plug = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.0112, 0.019, 0.0058, 4, 0.0026), plugMat);
  body.position.set(p.x, p.y - 0.0101, p.z);
  const tip = new THREE.Mesh(new RoundedBoxGeometry(0.0084, 0.0068, 0.0026, 3, 0.0012), tipMat);
  tip.position.set(p.x, p.y + 0.0034, p.z);
  plug.add(body, tip);

  // Packets run up the hanging part only: from where it meets the floor to the plug.
  const lengths = curve.getLengths(400);
  const total = lengths[lengths.length - 1];
  let floorAt = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (curve.getPoint(i / (lengths.length - 1)).y <= floor + 0.002) {
      floorAt = lengths[i] / total;
      break;
    }
  }

  return { cableFrame: g, tube, mats: [mat, plugMat, tipMat], uniforms, plug, curve, floorAt, toG, toLocal };
}

type Props = {
  boot: THREE.Object3D | null;
  rst: THREE.Object3D | null;
};

export default function KitFx({ boot, rst }: Props) {
  const root = useRef<THREE.Group>(null);
  const cable = useMemo(() => buildCable(), []);

  const packets = useMemo(() => {
    const n = 16;
    const mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.0011, 8, 8),
      new THREE.MeshBasicMaterial({ color: LED, toneMapped: false }),
      n,
    );
    mesh.frustumCulled = false;
    mesh.visible = false;
    return { mesh, n };
  }, []);

  const rings = useMemo(
    () => ({
      usb: glowRing(0.0072),
      boot: glowRing(0.0034),
      rst: glowRing(0.0034),
    }),
    [],
  );

  const sweep = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uColor: { value: LED.clone().multiplyScalar(1.4) } },
      vertexShader: sweepVert,
      fragmentShader: sweepFrag,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(SHIELD.w, SHIELD.h), mat);
    m.position.set(KIT.module.x, KIT.module.y, SHIELD.z);
    m.visible = false;
    return m;
  }, []);

  // A light that comes on with the DevKit held up: its board is dark and
  // takes little from the room's light. Its reach is in world units (1.6,
  // about 0.9 of it to the board); the case is nearly 3 away, out of it.
  const light = useMemo(() => {
    const l = new THREE.PointLight("#fff3e6", 0, 1.6, 2);
    // Up front and a little left and above, in the DevKit's own frame.
    l.position.set(-0.03, 0.04, 0.07);
    return l;
  }, []);

  // Wi-Fi leaving the antenna: arcs opening upward (+Y) in the board's plane.
  const waves = useMemo(
    () =>
      [0, 1, 2].map(() => {
        // They write depth: they are thin, nothing is behind them to hide, and
        // the stage's soft focus (look/StagePost) needs to know they are here
        // at the antenna and not out with the background.
        const mat = new THREE.MeshBasicMaterial({ color: LED, transparent: true, opacity: 0, toneMapped: false, side: THREE.DoubleSide });
        const arc = Math.PI * 0.5;
        const m = new THREE.Mesh(new THREE.TorusGeometry(0.0055, 0.0004, 6, 40, arc), mat);
        m.rotation.z = Math.PI / 2 - arc / 2;
        m.position.copy(KIT.antenna);
        return m;
      }),
    [],
  );

  const homes = useMemo(
    () => ({ boot: boot?.position.clone() ?? null, rst: rst?.position.clone() ?? null }),
    [boot, rst],
  );

  const tags = useRef<Record<string, HTMLDivElement | null>>({});
  const size = useThree((st) => st.size);
  const powerHeld = useRef(false);
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      v: new THREE.Vector3(),
      move: new THREE.Vector3(),
      at: new THREE.Vector3(),
      edge: new THREE.Vector3(),
      clear: new THREE.Vector3(),
    }),
    [],
  );

  // Without this component there is no cable, so nothing may stay held.
  useEffect(
    () => () => {
      kitState.cable = 0;
      kitState.seated = true;
    },
    [],
  );

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const { scene, step, page } = useGuideStore.getState();
    const s = stepOf(scene, step);
    const t = state.clock.elapsedTime;
    const now = performance.now();

    // Where the DevKit is: held up in front (the cable may come), or home.
    const pivot = root.current?.parent;
    const presented =
      !!pivot &&
      pivot.position.distanceToSquared(DEVKIT_PRESENT.position) < 1e-6 &&
      pivot.quaternion.angleTo(DEVKIT_PRESENT.quaternion) < 1e-3;
    kitState.seated = !pivot || pivot.position.distanceToSquared(DEVKIT_SEAT.position) < 1e-6;
    kitState.presented = presented;
    useGuideStore.getState().setKitPresented(presented);
    // Past the case's right side (x 12.2) or well in front of it.
    kitState.out = !!pivot && (pivot.position.x > 14.5 || pivot.position.z > 6);
    // What is drawn on the DevKit waits until it has arrived in front.
    const here = presented ? 1 : 0;

    // ── power ──────────────────────────────────────────────────────────────
    // The board has no brain until the DevKit is back on its pins, and the
    // guide says to close the back before plugging in: a step that powers
    // the device on keeps it off until both are done, then boots it (the
    // simulator fades the panel up from off, as the firmware does).
    const sim = getSim();
    const slider = pivot?.parent?.getObjectByName("back_slider");
    const shut = !slider || (slider.position.lengthSq() < 1e-8 && Math.abs(slider.quaternion.w) > 0.99999);
    const home = kitState.seated && shut;
    kitState.home = home;
    if (s.power && !home) {
      if (sim.snapshot().mode !== "off") sim.setMode("off");
      powerHeld.current = true;
    } else if (powerHeld.current) {
      powerHeld.current = false;
      if (s.power) sim.setMode(s.mode && s.mode !== "off" ? s.mode : "run");
    }
    // The DevKit's radio: on the network, or — the chapter's last card,
    // "Still no Wi-Fi?" — its own hotspot, which hold K2 then names
    // (scenes.ts Step.hotspot). Said every frame, so no step keeps it.
    sim.setHotspot(Boolean(s.hotspot));

    // ── the cable ──────────────────────────────────────────────────────────
    // Up to 1 it comes (rising into place and fading in) or goes (dropping
    // and fading out); from 1 to 2 the plug slides along the port's axis.
    const want = s.cable && presented ? 2 : 0;
    let c = kitState.cable;
    if (want !== c) {
      // Unplugging on the way to another step is quicker than plugging in.
      const rate = (c > 1 || (c === 1 && want > 1) ? 1 / SLIDE_S : 1 / COME_S) * (want < c ? 1.6 : 1) * dt;
      let next = c + Math.sign(want - c) * Math.min(Math.abs(want - c), rate);
      // Never across the 1 in one frame: slide and come/go are separate beats.
      if ((c - 1) * (next - 1) < 0) next = 1;
      c = next;
      kitState.cable = c;
    }
    const shown = c > 0.001;
    cable.cableFrame.visible = shown;
    cable.plug.visible = shown;
    if (shown) {
      const out = (1 - smooth(c - 1)) * UNPLUG; // along −Y, the port's axis
      // One curve both ways, so turning back halfway never jumps: going, it
      // falls away faster and faster; coming, it rises and settles into place.
      const k = 1 - Math.min(1, c);
      const drop = k * k * DROP;
      // The plug in the DevKit's frame: out along −Y, then down along world down.
      tmp.move.set(0, -1, 0).applyQuaternion(cable.toLocal).multiplyScalar(drop);
      cable.plug.position.set(0, -out, 0).add(tmp.move);
      // The tube, in gravity axes: its upper part follows the plug.
      cable.uniforms.uMove.value.set(0, -out, 0).applyQuaternion(cable.toG);
      cable.uniforms.uMove.value.y -= drop;
      const opacity = smooth(Math.min(1, c) / 0.8);
      for (const m of cable.mats) m.opacity = opacity;
    }

    const flashing = Boolean(s.flashing) && c > 1.98;
    packets.mesh.visible = flashing;
    if (flashing) {
      for (let i = 0; i < packets.n; i++) {
        // From where it leaves the floor up to the plug, toward the board.
        const ph = (((t * 0.9 + i / packets.n) % 1) + 1) % 1;
        const u = cable.floorAt * (1 - ph);
        cable.curve.getPointAt(Math.min(0.999, Math.max(0, u)), tmp.v);
        // Out of gravity axes into the DevKit's frame, then just proud of the tube, toward the reader.
        tmp.v.applyQuaternion(cable.toLocal);
        tmp.m.makeTranslation(tmp.v.x, tmp.v.y, tmp.v.z + CABLE_R * 1.2);
        packets.mesh.setMatrixAt(i, tmp.m);
      }
      packets.mesh.instanceMatrix.needsUpdate = true;
    }

    // ── rings, buttons, tags ───────────────────────────────────────────────
    // The Wi-Fi step: RST first, as its card says — named and pressed while
    // the card's flasher screens are at the first of the usual way
    // ("Usually: after RST", Connect to Wi-Fi), or while none of them is on
    // screen and the card's words are what is being read. Never under the
    // Wi-Fi form, or the setup straight after an install: pressed there,
    // RST would abort it.
    const fl = useGuideStore.getState().flasher;
    const rstNow = Boolean(s.rstPulse) && (!fl || (fl.set === "dashboard" && fl.index === 0));
    // From when that screen came up, a beat after it; with no screen up, on the clock.
    const rstSince = rstNow ? (fl ? now - fl.at : now) : 0;
    const tagsOn = new Set(presented ? (s.espTags ?? []).filter((k) => k !== "rst" || !s.rstPulse || rstNow) : []);
    const fade = (ring: THREE.Mesh, target: number) => {
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity += (target - mat.opacity) * Math.min(1, dt * 8);
      ring.visible = mat.opacity > 0.01;
    };
    const pulse = 0.55 + 0.35 * Math.sin(t * 5);
    // The port ring waits for the plug to be on its way.
    fade(rings.usb, tagsOn.has("usb") && c > 1 ? pulse : 0);

    // BOOT held, RST tapped, BOOT released — the same loop, off the same
    // clock, as the chips in the card (timing.ts).
    let bootDown = false;
    let rstDown = false;
    if (s.bootSeq) {
      const ph = bootPhase(now);
      bootDown = ph.bootDown;
      rstDown = ph.rstDown;
    } else if (rstNow) {
      // A beat after the screen comes up, and again each loop if it stays.
      rstDown = rstPulseDown(rstSince - 500 + RST_PULSE.down);
    }
    const rstIdle = rstNow ? 0.3 + 0.15 * Math.sin(t * 3) : 0.25;
    // …and under the reader's own finger, on that step (Device.tsx, hand.ts kitPress): the same press.
    if (s.bootSeq) {
      bootDown ||= kitPress.boot;
      rstDown ||= kitPress.rst;
    }
    if (!presented) {
      bootDown = false;
      rstDown = false;
    }
    fade(rings.boot, bootDown ? 1 : tagsOn.has("boot") ? 0.25 : 0);
    fade(rings.rst, rstDown ? 1 : tagsOn.has("rst") ? rstIdle : 0);
    if (boot && homes.boot) boot.position.z = homes.boot.z - (bootDown ? KIT.press : 0);
    if (rst && homes.rst) rst.position.z = homes.rst.z - (rstDown ? KIT.press : 0);

    {
      const u = (sweep.material as THREE.ShaderMaterial).uniforms;
      u.uTime.value = t;
      u.uFade.value += ((flashing ? 1 : 0) - u.uFade.value) * Math.min(1, dt * 5);
      sweep.visible = u.uFade.value > 0.01;
    }
    // The DevKit's own light, up while it is held up in front.
    light.intensity += ((presented ? KIT_LIGHT : 0) - light.intensity) * Math.min(1, dt * 3);

    // The Wi-Fi's arcs are the page's sign, as the device's own are (Fx.tsx): in the page's accent.
    // They wait while RST is the thing to do: the Wi-Fi comes after it.
    const accent = stageAccent();
    const arcs = s.wifi === "esp" && !rstNow;
    waves.forEach((w, i) => {
      const phase = (((t * 0.7 + i / 3) % 1) + 1) % 1;
      w.scale.setScalar(1 + phase * 1.9);
      const mat = w.material as THREE.MeshBasicMaterial;
      mat.color.copy(accent);
      const target = arcs ? (1 - phase) * 0.9 * here : 0;
      mat.opacity += (target - mat.opacity) * Math.min(1, dt * (arcs ? 6 : 10));
      w.visible = mat.opacity > 0.01;
    });

    const setTag = (key: string, on: boolean, active = false) => {
      const el = tags.current[key];
      if (!el) return;
      el.dataset.on = on ? "1" : "0";
      el.dataset.active = active ? "1" : "0";
    };
    // Of the two ports the marked one is the one the step is about: USB, the
    // port the cable goes into — except on the Audio guide's "leave the right
    // port empty", whose card and warning are about UART (scenes/audio.ts).
    const uartMarked = micPortStep(page, scene, step);
    setTag("usb", tagsOn.has("usb"), !uartMarked);
    setTag("uart", tagsOn.has("uart"), uartMarked);
    setTag("boot", tagsOn.has("boot"), bootDown);
    setTag("rst", tagsOn.has("rst"), rstDown);

    // Beside what they name, in screen pixels (tags.ts): USB to the left of
    // its port (the cable hangs below it), UART to the right of its own, BOOT
    // and RST to the right of their buttons, past the pin header and level
    // with the button, with a hairline back to it.
    const g = root.current;
    if (g && tagsOn.size) {
      g.updateWorldMatrix(true, false);
      const place = (key: "usb" | "uart" | "boot" | "rst", p: THREE.Vector3, r: number, side: TagSide, clearX?: number, dy = 0) => {
        const el = tags.current[key];
        if (!el || !tagsOn.has(key)) return;
        g.localToWorld(tmp.at.copy(p));
        g.localToWorld(tmp.edge.copy(p).setX(p.x + r));
        const clear = clearX === undefined ? undefined : g.localToWorld(tmp.clear.copy(p).setX(clearX));
        placeTag(el, state.camera, size, tmp.at, tmp.at.distanceTo(tmp.edge), side, 8, clear, dy);
      };
      place("usb", TAG_AT.usb, 0.0062, "left");
      place("uart", TAG_AT.uart, 0.0062, "right");
      // RST sits 5 mm above BOOT: on a phone that is less than a pill's
      // height, so the two part just enough not to overlap.
      let spread = 0;
      const rstEl = tags.current.rst;
      if (rstEl && tagsOn.has("rst") && tagsOn.has("boot")) {
        const yr = screenY(state.camera, size, g.localToWorld(tmp.at.copy(KIT.rst)));
        const yb = screenY(state.camera, size, g.localToWorld(tmp.at.copy(KIT.boot)));
        spread = Math.max(0, (pillSize(rstEl).h + 4 - Math.abs(yb - yr)) / 2);
      }
      place("boot", KIT.boot, 0.0034, "right", PIN_ROW_X, spread);
      place("rst", KIT.rst, 0.0034, "right", PIN_ROW_X, -spread);
    }
  });

  // Anchored on what they name; placed beside it every frame (above).
  const tag = (key: string, label: string, p: THREE.Vector3) => (
    <Html position={[p.x, p.y, p.z]} center zIndexRange={[20, 0]} style={NO_POINTER}>
      <div
        ref={(el) => {
          tags.current[key] = el;
        }}
        className="guide-knob-tag"
        data-on="0"
      >
        {label}
      </div>
    </Html>
  );

  return (
    <group ref={root}>
      <primitive object={cable.cableFrame} />
      <primitive object={cable.plug} />
      <primitive object={packets.mesh} />
      {(Object.keys(rings) as (keyof typeof rings)[]).map((key) => {
        const at = KIT[key];
        return <primitive key={key} object={rings[key]} position={[at.x, at.y + (key === "usb" ? 0.0036 : 0), at.z + 0.0018]} />;
      })}
      {waves.map((w, i) => (
        <primitive key={i} object={w} />
      ))}
      <primitive object={sweep} />
      <primitive object={light} />
      {/* The names printed on the board (kitMaterials.ts silkscreen). */}
      {tag("usb", "USB", TAG_AT.usb)}
      {tag("uart", "UART", TAG_AT.uart)}
      {tag("boot", "BOOT", KIT.boot)}
      {tag("rst", "RST", KIT.rst)}
    </group>
  );
}
