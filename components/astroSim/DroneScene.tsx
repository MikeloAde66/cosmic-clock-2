'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { LaunchStack } from './Shuttle';

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
  moonDist: number;
  pitchDeg: number;
  rollDeg: number;
  headingDeg: number;
  /** 0..1, how directly the pilot is looking into the Sun. */
  sunGlow: number;
  stage: 'approach' | 'orbit' | 'done';
  /** 0..1, how much of the single orbit has been flown. */
  orbit: number;
  /** distance from the ship to the orbit ring, in units */
  toRing: number;
  assisting: boolean;
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

// Everything here is deliberately small and slow: the Moon starts as a modest
// disc, and the pilot crawls toward it. Speed is felt, not seen.
const MOON_RADIUS = 450;
const MOON_POS = new THREE.Vector3(-350, -60, -2400);
const MAX_SPEED = 80;
const MIN_THROTTLE = 0.12; // the vessel never sits still: there is always a cruise
const ORBIT_ALT = 150;
const ORBIT_R = MOON_RADIUS + ORBIT_ALT;
const ORBIT_N = new THREE.Vector3(0.12, 1, 0.1).normalize(); // the ring's plane
const SUN_DIR = new THREE.Vector3(3000, 1200, 2000).normalize();

// Fixed in-plane basis for measuring how far round the ring the ship has gone.
const RING_E1 = new THREE.Vector3().crossVectors(ORBIT_N, new THREE.Vector3(0, 0, 1)).normalize();
const RING_E2 = new THREE.Vector3().crossVectors(ORBIT_N, RING_E1).normalize();

// A thin guide ring marking the orbit.
function OrbitRing() {
  const ring = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      pts.push(RING_E1.clone().multiplyScalar(Math.cos(a) * ORBIT_R).add(RING_E2.clone().multiplyScalar(Math.sin(a) * ORBIT_R)));
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 0.55, depthWrite: false }),
    );
    line.position.copy(MOON_POS);
    return line;
  }, []);
  return <primitive object={ring} />;
}

function Moon() {
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
    <mesh ref={mesh} position={MOON_POS} rotation={[0.1, 2.2, 0]}>
      <sphereGeometry args={[MOON_RADIUS, 96, 64]} />
      <meshStandardMaterial key={map ? 'textured' : 'plain'} map={map ?? undefined} color={map ? '#ffffff' : '#7a7a7a'} roughness={1} />
    </mesh>
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

// Pilot's-eye flight: no vehicle in view, the camera IS the cockpit window.
function FlightScene({ inputs, onHud }: { inputs: React.RefObject<DroneInputs>; onHud: (h: DroneHud) => void }) {
  const ship = useRef<THREE.Group>(null);
  const state = useRef({ thr: 0.35, speed: 28, yawS: 0, pitchS: 0, rollS: 0, t: 0, hudT: 0, lastRecenter: 0, auto: 0, lastReset: 0, look: 0, accum: 0, prevA: null as number | null, dir: 0, stage: 'approach' as 'approach' | 'orbit' | 'done', assisting: false });
  const lookM = useMemo(() => new THREE.Matrix4(), []);
  const goalQ = useMemo(() => new THREE.Quaternion(), []);
  const keys = useRef({ w: 0, s: 0, a: 0, d: 0, up: 0, down: 0, left: 0, right: 0 });
  const { camera } = useThree();
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const dq = useMemo(() => new THREE.Quaternion(), []);
  const rel = useMemo(() => new THREE.Vector3(), []);
  const radial = useMemo(() => new THREE.Vector3(), []);
  const tang = useMemo(() => new THREE.Vector3(), []);
  const aim = useMemo(() => new THREE.Vector3(), []);
  const camQ = useMemo(() => new THREE.Quaternion(), []);
  const swayQ = useMemo(() => new THREE.Quaternion(), []);
  const swayE = useMemo(() => new THREE.Euler(), []);

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

    // Ease every control toward its target, so nothing snaps or stops dead:
    // a critically damped feel, rates blend in and out rather than switching.
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

    // autopilot: swing the nose onto the Moon, wings level, over a couple of seconds
    const rc = i.recenter ?? 0;
    if (rc && rc !== s.lastRecenter) {
      s.lastRecenter = rc;
      s.auto = 4.5;
    }
    if (s.auto > 0) {
      s.auto -= dt;
      lookM.lookAt(g.position, MOON_POS, tmp.set(0, 1, 0));
      goalQ.setFromRotationMatrix(lookM);
      g.quaternion.slerp(goalQ, 1 - Math.exp(-dt * 1.0));
    }

    // orbit assist: when the sticks rest and the ship is near the ring, steer along it
    if (i.resetMission && i.resetMission !== s.lastReset) {
      s.lastReset = i.resetMission;
      s.stage = 'approach';
      s.accum = 0;
      s.prevA = null;
      s.dir = 0;
    }
    rel.copy(g.position).sub(MOON_POS);
    const rDist = rel.length();
    const handsOn = Math.abs(yawIn) + Math.abs(pitchIn) + Math.abs(rollIn) > 0.2;
    s.assisting = (i.assist ?? true) && !handsOn && s.stage !== 'done' && rDist < ORBIT_R + 500 && s.auto <= 0;
    if (s.assisting) {
      // project onto the ring plane, then aim a little way ahead along the ring
      radial.copy(rel).addScaledVector(ORBIT_N, -rel.dot(ORBIT_N));
      if (radial.lengthSq() < 1) radial.copy(RING_E1);
      radial.normalize();
      fwd.set(0, 0, -1).applyQuaternion(g.quaternion);
      tang.crossVectors(ORBIT_N, radial);
      const dirSign = s.dir !== 0 ? s.dir : tang.dot(fwd) >= 0 ? 1 : -1;
      aim.copy(MOON_POS).addScaledVector(radial, ORBIT_R * Math.cos(0.4)).addScaledVector(tang, dirSign * ORBIT_R * Math.sin(0.4));
      lookM.lookAt(g.position, aim, tmp.set(0, 1, 0));
      goalQ.setFromRotationMatrix(lookM);
      g.quaternion.slerp(goalQ, 1 - Math.exp(-dt * 0.9));
    }

    fwd.set(0, 0, -1).applyQuaternion(g.quaternion);
    g.position.addScaledVector(fwd, s.speed * dt);

    // slide around the Moon rather than stopping against it
    const toMoon = tmp.copy(g.position).sub(MOON_POS);
    const dist = toMoon.length() - MOON_RADIUS;
    const toRing = Math.abs(dist + MOON_RADIUS - ORBIT_R);
    if (dist < 60) {
      g.position.copy(MOON_POS).add(toMoon.normalize().multiplyScalar(MOON_RADIUS + 60));
    }

    // mission: one full lap of the ring, measured as angle swept about the Moon
    if (s.stage !== 'done') {
      rel.copy(g.position).sub(MOON_POS);
      const rr = rel.length();
      const offPlane = Math.abs(rel.dot(ORBIT_N));
      const onRing = Math.abs(rr - ORBIT_R) < 140 && offPlane < 140;
      if (onRing) {
        const a = Math.atan2(rel.dot(RING_E2), rel.dot(RING_E1));
        if (s.prevA !== null) {
          let d = a - s.prevA;
          if (d > Math.PI) d -= Math.PI * 2;
          if (d < -Math.PI) d += Math.PI * 2;
          s.accum += d;
          if (s.dir === 0 && Math.abs(s.accum) > 0.05) s.dir = Math.sign(s.accum);
        }
        s.prevA = a;
        if (s.stage === 'approach') s.stage = 'orbit';
        if (Math.abs(s.accum) >= Math.PI * 2) s.stage = 'done';
      } else {
        s.prevA = null;
        if (rr > ORBIT_R + 700 && s.stage === 'orbit') {
          s.stage = 'approach'; // wandered off: start the lap again
          s.accum = 0;
          s.dir = 0;
        }
      }
    }

    // the camera is the pilot's head: ship pose + gentle sway + lean into turns
    // while the assist flies the ring, the pilot turns their head toward the Moon
    aim.set(1, 0, 0).applyQuaternion(g.quaternion);
    const side = aim.dot(rel.copy(MOON_POS).sub(g.position)) >= 0 ? -1 : 1;
    s.look += ((s.assisting ? 0.9 * side : 0) - s.look) * (1 - Math.exp(-dt * 0.7));
    swayE.set(
      Math.sin(s.t * 0.7) * 0.0035 + Math.sin(s.t * 1.9) * 0.0014 - Math.abs(s.look) * 0.08,
      Math.sin(s.t * 0.5 + 1) * 0.003 + s.look,
      -s.yawS * 0.04 + Math.sin(s.t * 0.9 + 2) * 0.0035,
      'YXZ',
    );
    swayQ.setFromEuler(swayE);
    camQ.copy(g.quaternion).multiply(swayQ);
    camera.quaternion.slerp(camQ, 1 - Math.exp(-dt * 12));
    camera.position.copy(g.position);

    s.hudT += dt;
    if (s.hudT > 0.1) {
      s.hudT = 0;
      const f = fwd;
      const up = tmp.set(0, 1, 0).applyQuaternion(g.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(g.quaternion);
      const pitchDeg = (Math.asin(Math.max(-1, Math.min(1, f.y))) * 180) / Math.PI;
      const rollDeg = (Math.atan2(right.y, up.y) * 180) / Math.PI;
      const headingDeg = ((Math.atan2(f.x, -f.z) * 180) / Math.PI + 360) % 360;
      const sunDot = f.dot(SUN_DIR);
      const sunGlow = Math.max(0, Math.min(1, (sunDot - 0.82) / 0.17));
      onHud({ speed: s.speed, throttle: s.thr, moonDist: Math.max(0, dist), pitchDeg, rollDeg, headingDeg, sunGlow, stage: s.stage, orbit: Math.min(1, Math.abs(s.accum) / (Math.PI * 2)), toRing, assisting: s.assisting });
    }
  });

  return (
    <>
      <color attach="background" args={['#000005']} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[3000, 1200, 2000]} intensity={2.6} />
      <Stars radius={60000} depth={2000} count={5000} factor={400} fade={false} speed={0.6} />
      <SunGlow />
      <Moon />
      <OrbitRing />
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
