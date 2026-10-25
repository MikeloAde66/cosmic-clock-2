'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { LaunchStack } from './Shuttle';
import type { Stage } from '@/lib/astroSim/droneMission';

// Stick values, each -1..1, y up-positive. Left = yaw + throttle, right = roll + pitch.
export interface DroneInputs {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  /** Set to a new timestamp to ask the autopilot to swing the nose toward the Moon. */
  recenter?: number;
  /** Orbit assist: gently holds the orbit ring once the pilot lets go of the sticks. */
  assist?: boolean;
  /** Set to a new timestamp to restart the mission. */
  resetMission?: number;
}

export interface DroneHud {
  speed: number;
  throttle: number;
  pitchDeg: number;
  rollDeg: number;
  headingDeg: number;
  /** 0..1, how directly the pilot is looking into the Sun. */
  sunGlow: number;
  /** mission clock, seconds */
  t: number;
  stage: Stage;
  /** 0..1, how much of the single lap has been flown */
  orbit: number;
  /** angle between the nose and the Moon, degrees */
  facingDeg: number;
  /** 0..1, progress of the pointing lock */
  lock: number;
  assisting: boolean;
  // simulated surroundings
  altKm: number;
  velKms: number;
  rangeKm: number;
  tempC: number;
  pressureBar: number;
  gLoad: number;
  localG: number;
  radUsv: number;
  linkDb: number;
  linkLost: boolean;
}

const LAUNCH_SECONDS = 5;

function countdownLabel(t: number): string {
  if (t < 1) return 'T-3';
  if (t < 2) return 'T-2';
  if (t < 3) return 'T-1';
  if (t < 3.6) return 'IGNITION';
  return 'LIFTOFF';
}

// ---------------------------------------------------------------- launch pad

function PadScene({ onLabel, onDone }: { onLabel: (s: string) => void; onDone: () => void }) {
  const t = useRef(0);
  const lastLabel = useRef('');
  const done = useRef(false);
  const stack = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const smoke = useRef<(THREE.Mesh | null)[]>([]);
  const { camera } = useThree();
  const puffs = useMemo(
    () => Array.from({ length: 28 }, (_, i) => ({ a: (i / 28) * Math.PI * 2 + (i % 3), d: 6 + (i % 7) * 4, delay: (i % 5) * 0.12 })),
    [],
  );

  useFrame((_, dt) => {
    t.current += Math.min(dt, 0.1);
    const time = t.current;
    const label = countdownLabel(time);
    if (label !== lastLabel.current) {
      lastLabel.current = label;
      onLabel(label);
    }
    const lift = Math.max(0, time - 3.4);
    const y = 0.5 * 26 * lift * lift;
    if (stack.current) {
      stack.current.position.y = y;
      stack.current.position.x = time > 3.4 ? Math.sin(time * 40) * 0.05 : 0;
    }
    const burning = time >= 3;
    if (flame.current) {
      flame.current.visible = burning;
      const k = Math.min(1, (time - 3) / 0.6);
      flame.current.scale.set(1 + Math.sin(time * 60) * 0.06, k * (1 + Math.sin(time * 45) * 0.1), 1 + Math.sin(time * 52) * 0.06);
      flame.current.position.y = y - 12 * k;
    }
    smoke.current.forEach((m, i) => {
      if (!m) return;
      const p = puffs[i];
      const s = time - 3 - p.delay;
      m.visible = s > 0;
      if (s > 0) {
        const grow = 1 + s * 5;
        m.scale.setScalar(grow * 2.2);
        m.position.set(Math.cos(p.a) * (p.d + s * 7), 2 + s * 1.5, Math.sin(p.a) * (p.d + s * 7));
        (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.55 - s * 0.2);
      }
    });
    // camera: holds on the pad, then tilts up to follow the stack
    camera.position.set(70, 14, 105);
    camera.lookAt(0, 34 + y * 0.55, 0);
    if (time >= LAUNCH_SECONDS && !done.current) {
      done.current = true;
      onDone();
    }
  });

  return (
    <>
      <color attach="background" args={['#9cc3e6']} />
      <fog attach="fog" args={['#b7d3ea', 160, 700]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[80, 120, 60]} intensity={2.2} />
      {/* ground and pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color="#6f7f58" roughness={1} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[70, 1.8, 70]} />
        <meshStandardMaterial color="#8d9094" roughness={0.9} />
      </mesh>
      {/* service tower */}
      <mesh position={[-22, 38, 0]}>
        <boxGeometry args={[6, 76, 6]} />
        <meshStandardMaterial color="#a7332a" roughness={0.8} />
      </mesh>
      <mesh position={[-13, 40, 0]}>
        <boxGeometry args={[14, 2.5, 3]} />
        <meshStandardMaterial color="#a7332a" roughness={0.8} />
      </mesh>
      <group ref={stack} position={[0, 1.8, 0]}>
        <LaunchStack />
      </group>
      <mesh ref={flame} visible={false} position={[0, 0, 0]}>
        <coneGeometry args={[6, 26, 20, 1, true]} />
        <meshBasicMaterial color="#ff8a1f" transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {puffs.map((_, i) => (
        <mesh key={i} ref={(m) => void (smoke.current[i] = m)} visible={false}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color="#e6e6e6" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

// -------------------------------------------------------------------- flight

// The Moon is a fixed backdrop in the sky: it never slides around the window,
// it only turns on its axis, and it grows slowly as the pilot descends. Travel
// is shown by the drifting dust, the stars and the instruments.
const MOON_RADIUS = 450;
const MOON_DIR = new THREE.Vector3(-0.14, -0.03, -1).normalize();
const MAX_SPEED = 80;
const MIN_THROTTLE = 0.12; // the vessel never sits still: there is always a cruise
const SUN_DIR = new THREE.Vector3(3000, 1200, 2000).normalize();
const ORIGIN = new THREE.Vector3();
const REAL_MOON_KM = 1737;
const ALT_START = 1900; // km, simulated
const ALT_ORBIT = 110;
const LAP_RATE = 0.0125; // fraction of a lap per second, scaled by throttle
const LOS_FROM = 0.42; // the far side of the Moon blocks the radio from here ...
const LOS_TO = 0.56; // ... to here

// How far away the Moon is drawn for a given simulated altitude.
const moonDistance = (altKm: number) => MOON_RADIUS * 2.6 + (altKm - ALT_ORBIT) * 0.8;

function Moon({ groupRef }: { groupRef: React.RefObject<THREE.Group | null> }) {
  const [map, setMap] = useState<THREE.Texture | null>(null);
  const mesh = useRef<THREE.Mesh>(null);
  useEffect(() => {
    let alive = true;
    new THREE.TextureLoader().load(
      '/textures/moon.jpg',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        if (alive) setMap(tex);
      },
      undefined,
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);
  useFrame((_, dt) => {
    if (mesh.current) mesh.current.rotation.y += dt * 0.004; // slow, endless turn
  });
  return (
    <group ref={groupRef}>
      <mesh ref={mesh} rotation={[0.1, 2.2, 0]}>
        <sphereGeometry args={[MOON_RADIUS, 96, 64]} />
        <meshStandardMaterial key={map ? 'textured' : 'plain'} map={map ?? undefined} color={map ? '#ffffff' : '#7a7a7a'} roughness={1} />
      </mesh>
    </group>
  );
}

// A soft additive glow standing in for the Sun's disc and halo.
function SunGlow() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,245,1)');
    grad.addColorStop(0.08, 'rgba(255,244,214,0.95)');
    grad.addColorStop(0.25, 'rgba(255,200,120,0.35)');
    grad.addColorStop(1, 'rgba(255,160,60,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);
  return (
    <sprite position={SUN_DIR.clone().multiplyScalar(60000)} scale={[16000, 16000, 1]}>
      <spriteMaterial map={tex} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </sprite>
  );
}

const DUST_N = 700;
const DUST_BOX = 260;

// Pilot's-eye flight: no vehicle in view, the camera IS the cockpit window.
function FlightScene({ inputs, onHud }: { inputs: React.RefObject<DroneInputs>; onHud: (h: DroneHud) => void }) {
  const ship = useRef<THREE.Group>(null);
  const moon = useRef<THREE.Group>(null);
  const state = useRef({
    thr: 0.35, speed: 28, yawS: 0, pitchS: 0, rollS: 0, t: 0, hudT: 0, lastRecenter: 0, auto: 0, lastReset: 0,
    lock: 0, stage: 'acquire' as Stage, orbit: 0, alt: ALT_START, temp: -18, linkLost: false, assisting: false,
  });
  const lookM = useMemo(() => new THREE.Matrix4(), []);
  const goalQ = useMemo(() => new THREE.Quaternion(), []);
  const keys = useRef({ w: 0, s: 0, a: 0, d: 0, up: 0, down: 0, left: 0, right: 0 });
  const { camera } = useThree();
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const dq = useMemo(() => new THREE.Quaternion(), []);
  const camQ = useMemo(() => new THREE.Quaternion(), []);
  const swayQ = useMemo(() => new THREE.Quaternion(), []);
  const swayE = useMemo(() => new THREE.Euler(), []);

  // Dust streaming past the window: the felt sense of speed. Deterministic, so
  // every flight starts with the same field.
  const dustRef = useRef<THREE.Points>(null);
  const dustPos = useMemo(() => {
    let seed = 20260711;
    const rnd = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pos = new Float32Array(DUST_N * 3);
    for (let i = 0; i < pos.length; i++) pos[i] = (rnd() * 2 - 1) * DUST_BOX;
    return pos;
  }, []);

  useEffect(() => {
    const map: Record<string, keyof typeof keys.current> = {
      w: 'w', s: 's', a: 'a', d: 'd', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    };
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
    const down = (e: KeyboardEvent) => {
      const k = map[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (k && !typing(e)) {
        keys.current[k] = 1;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = map[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (k) keys.current[k] = 0;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useFrame((_, rawDt) => {
    const g = ship.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.05);
    const s = state.current;
    const k = keys.current;
    s.t += dt;

    // gamepad (standard mapping): left stick yaw/throttle, right stick roll/pitch
    let gl = { x: 0, y: 0 }, gr = { x: 0, y: 0 };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.connected) {
        const dz = (v: number) => (Math.abs(v) < 0.12 ? 0 : v);
        gl = { x: dz(p.axes[0] ?? 0), y: -dz(p.axes[1] ?? 0) };
        gr = { x: dz(p.axes[2] ?? 0), y: -dz(p.axes[3] ?? 0) };
        break;
      }
    }
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const i = inputs.current;
    const yawIn = clamp(i.lx + gl.x + k.d - k.a);
    const thrIn = clamp(i.ly + gl.y + k.w - k.s);
    const rollIn = clamp(i.rx + gr.x + k.right - k.left);
    const pitchIn = clamp(i.ry + gr.y + k.up - k.down);

    // Ease every control toward its target, so nothing snaps or stops dead.
    const ease = 1 - Math.exp(-dt * 2.2);
    s.yawS += (yawIn - s.yawS) * ease;
    s.pitchS += (pitchIn - s.pitchS) * ease;
    s.rollS += (rollIn - s.rollS) * ease;

    s.thr = Math.max(MIN_THROTTLE, Math.min(1, s.thr + thrIn * dt * 0.22));
    s.speed += (s.thr * MAX_SPEED - s.speed) * (1 - Math.exp(-dt * 0.6));

    // orientation in the vessel's own axes (+ a whisper of constant drift)
    euler.set(s.pitchS * dt * 0.32, -(s.yawS * 0.28 + 0.004) * dt, -(s.rollS * 0.32 + 0.003) * dt, 'YXZ');
    dq.setFromEuler(euler);
    g.quaternion.multiply(dq).normalize();

    // restart the mission on request
    if (i.resetMission && i.resetMission !== s.lastReset) {
      s.lastReset = i.resetMission;
      s.stage = 'acquire';
      s.lock = 0;
      s.orbit = 0;
      s.alt = ALT_START;
      s.t = 0;
    }

    // autopilot: swing the nose onto the Moon over a few seconds
    const rc = i.recenter ?? 0;
    if (rc && rc !== s.lastRecenter) {
      s.lastRecenter = rc;
      s.auto = 4.5;
    }
    lookM.lookAt(ORIGIN, MOON_DIR, tmp.set(0, 1, 0));
    goalQ.setFromRotationMatrix(lookM);
    fwd.set(0, 0, -1).applyQuaternion(g.quaternion);
    const facingDeg = (Math.acos(Math.max(-1, Math.min(1, fwd.dot(MOON_DIR)))) * 180) / Math.PI;
    const handsOn = Math.abs(yawIn) + Math.abs(pitchIn) + Math.abs(rollIn) > 0.2;
    s.assisting = (i.assist ?? true) && !handsOn && s.auto <= 0 && (s.stage === 'burn' || s.stage === 'orbit') && facingDeg > 4;
    if (s.auto > 0) {
      s.auto -= dt;
      g.quaternion.slerp(goalQ, 1 - Math.exp(-dt * 1.0));
    } else if (s.assisting) {
      g.quaternion.slerp(goalQ, 1 - Math.exp(-dt * 0.5));
    }

    // the sun in the window
    fwd.set(0, 0, -1).applyQuaternion(g.quaternion);
    const sunGlow = Math.max(0, Math.min(1, (fwd.dot(SUN_DIR) - 0.82) / 0.17));

    // mission: line up on the Moon, burn down to orbit altitude, fly one lap
    if (s.stage === 'acquire') {
      s.lock = facingDeg < 8 ? s.lock + dt : Math.max(0, s.lock - dt * 0.5);
      s.alt = ALT_START + Math.sin(s.t * 0.4) * 4;
      if (s.lock >= 2.5) s.stage = 'burn';
    } else if (s.stage === 'burn') {
      if (s.thr > 0.6) s.alt -= (30 + 90 * s.thr) * dt;
      if (s.alt <= ALT_ORBIT + 2) {
        s.alt = ALT_ORBIT;
        s.stage = 'orbit';
      }
    } else {
      s.alt = ALT_ORBIT + Math.sin(s.t * 0.3) * 3;
      if (s.stage === 'orbit' && facingDeg < 60) {
        s.orbit = Math.min(1, s.orbit + LAP_RATE * (0.35 + s.thr) * dt);
        if (s.orbit >= 1) s.stage = 'done';
      }
    }
    s.linkLost = s.stage === 'orbit' && s.orbit > LOS_FROM && s.orbit < LOS_TO;

    // simulated surroundings
    const lapped = s.stage === 'orbit' || s.stage === 'done';
    const tempGoal = lapped ? -35 + 140 * Math.cos(s.orbit * Math.PI * 2) : -18 + sunGlow * 70;
    s.temp += (tempGoal - s.temp) * (1 - Math.exp(-dt * 0.6));

    // the Moon: fixed direction, distance follows the altitude, turns on its axis
    if (moon.current) moon.current.position.copy(MOON_DIR).multiplyScalar(moonDistance(s.alt));

    // dust streams back past the window at a fraction of the true speed
    const dustAttr = dustRef.current?.geometry.attributes.position;
    if (dustAttr) {
      const arr = dustAttr.array as Float32Array;
      const step = s.speed * 0.5 * dt;
      for (let n = 0; n < DUST_N; n++) {
        for (let c = 0; c < 3; c++) {
          let v = arr[n * 3 + c] - fwd.getComponent(c) * step;
          if (v > DUST_BOX) v -= DUST_BOX * 2;
          else if (v < -DUST_BOX) v += DUST_BOX * 2;
          arr[n * 3 + c] = v;
        }
      }
      dustAttr.needsUpdate = true;
    }

    // the camera is the pilot's head: ship pose + gentle sway + lean into turns
    swayE.set(
      Math.sin(s.t * 0.7) * 0.0035 + Math.sin(s.t * 1.9) * 0.0014,
      Math.sin(s.t * 0.5 + 1) * 0.003,
      -s.yawS * 0.04 + Math.sin(s.t * 0.9 + 2) * 0.0035,
      'YXZ',
    );
    swayQ.setFromEuler(swayE);
    camQ.copy(g.quaternion).multiply(swayQ);
    camera.quaternion.slerp(camQ, 1 - Math.exp(-dt * 12));
    camera.position.set(0, 0, 0);

    s.hudT += dt;
    if (s.hudT > 0.1) {
      s.hudT = 0;
      const f = fwd;
      const up = tmp.set(0, 1, 0).applyQuaternion(g.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(g.quaternion);
      const pitchDeg = (Math.asin(Math.max(-1, Math.min(1, f.y))) * 180) / Math.PI;
      const rollDeg = (Math.atan2(right.y, up.y) * 180) / Math.PI;
      const headingDeg = ((Math.atan2(f.x, -f.z) * 180) / Math.PI + 360) % 360;
      const burning = s.stage === 'burn' && s.thr > 0.6;
      onHud({
        speed: s.speed,
        throttle: s.thr,
        pitchDeg,
        rollDeg,
        headingDeg,
        sunGlow,
        t: s.t,
        stage: s.stage,
        orbit: s.orbit,
        facingDeg,
        lock: Math.min(1, s.lock / 2.5),
        assisting: s.assisting,
        altKm: s.alt,
        velKms: 0.1 + (s.speed / MAX_SPEED) * 1.6,
        rangeKm: s.alt + REAL_MOON_KM,
        tempC: s.temp,
        pressureBar: 3e-15 * (1 + 0.12 * Math.sin(s.t * 1.7) + 0.08 * Math.sin(s.t * 0.6)),
        gLoad: burning ? 0.02 + 0.03 * s.thr : 0,
        localG: 1.62 * (REAL_MOON_KM / (REAL_MOON_KM + s.alt)) ** 2,
        radUsv: 0.52 + sunGlow * 0.25 + (s.linkLost ? -0.07 : 0) + 0.02 * Math.sin(s.t * 2.3),
        linkDb: s.linkLost ? 0 : 36 + 3 * Math.sin(s.t * 0.4),
        linkLost: s.linkLost,
      });
    }
  });

  return (
    <>
      <color attach="background" args={['#000005']} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[3000, 1200, 2000]} intensity={2.6} />
      <Stars radius={60000} depth={2000} count={9000} factor={400} fade={false} speed={0.6} />
      <SunGlow />
      <Moon groupRef={moon} />
      <points ref={dustRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustPos, 3]} />
        </bufferGeometry>
        <pointsMaterial size={1.3} color="#a9bfd6" transparent opacity={0.5} depthWrite={false} sizeAttenuation />
      </points>
      <group ref={ship} />
    </>
  );
}

// ---------------------------------------------------------------------- root

export default function DroneScene({
  phase,
  inputs,
  onLabel,
  onLaunchDone,
  onHud,
}: {
  phase: 'pad' | 'flight';
  inputs: React.RefObject<DroneInputs>;
  onLabel: (s: string) => void;
  onLaunchDone: () => void;
  onHud: (h: DroneHud) => void;
}) {
  return (
    <Canvas camera={{ position: [70, 14, 105], fov: 50, near: 0.5, far: 120000 }} dpr={[1, 2]}>
      {phase === 'pad' ? <PadScene onLabel={onLabel} onDone={onLaunchDone} /> : <FlightScene inputs={inputs} onHud={onHud} />}
    </Canvas>
  );
}
