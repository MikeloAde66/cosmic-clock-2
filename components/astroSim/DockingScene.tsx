'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { newDock, speedCorridor, stepDock } from '@/lib/astroSim/docking';
import type { Dock, Phase, Result } from '@/lib/astroSim/docking';

// Mission 03, Deep Space Docking: the pilot's window on the approach. The station
// is built from simple shapes (a port node, a central module, a truss with solar
// arrays and a slowly turning habitat ring), lit by a low sun, with a distant
// planet behind it. No photographs: it is a stand-in, not any real station.

export interface DockingInputs {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  assist?: boolean;
}

export interface DockHud {
  t: number;
  phase: Phase;
  /** distance to the port, m */
  range: number;
  /** closing rate, m/s (positive = approaching) */
  closing: number;
  /** the speed corridor at this range, m/s */
  allowed: number;
  /** offset from the port axis, m */
  x: number;
  y: number;
  offset: number;
  vx: number;
  vy: number;
  sway: number;
  fuel: number;
  assisting: boolean;
  result: Result | null;
}

export const EMPTY_DOCK_HUD: DockHud = {
  t: 0, phase: 'rendezvous', range: 120, closing: 1.5, allowed: 1.5, x: 14, y: -8, offset: 16.1, vx: 0.12, vy: 0.04, sway: 0.13, fuel: 100, assisting: false, result: null,
};

const SUN_DIR = new THREE.Vector3(0.55, 0.42, 0.72).normalize();

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function planetTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d')!;
  const bands = ['#2c4f7a', '#3d6a9c', '#27466b', '#4d7fb0', '#2a4a72', '#406e9e'];
  const h = 512 / bands.length;
  bands.forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect(0, i * h, 1024, h + 1);
  });
  // soft swirls so the bands do not look like stripes
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 160; i++) {
    const x = rnd() * 1024, y = rnd() * 512, r = 20 + rnd() * 90;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const light = rnd() > 0.5;
    grad.addColorStop(0, light ? 'rgba(210,230,255,0.10)' : 'rgba(10,20,40,0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Planet() {
  const map = useMemo(() => planetTexture(), []);
  return (
    <mesh position={[-5200, -1500, -12000]} rotation={[0.3, 0.6, 0.15]}>
      <sphereGeometry args={[3600, 64, 48]} />
      <meshStandardMaterial map={map} roughness={0.95} metalness={0} />
    </mesh>
  );
}

// The station. The docking port is at the origin facing +z.
function Station() {
  const ring = useRef<THREE.Group>(null);
  const leds = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.z += Math.min(dt, 0.06) * 0.07;
  });
  useFrame(({ clock }) => {
    if (leds.current) leds.current.opacity = 0.4 + 0.6 * (Math.sin(clock.elapsedTime * 3) > 0 ? 1 : 0.15);
  });
  const hull = <meshStandardMaterial color="#c9ced1" roughness={0.55} metalness={0.45} />;
  const dark = <meshStandardMaterial color="#6f777c" roughness={0.6} metalness={0.5} />;
  const panel = <meshStandardMaterial color="#1c2c4a" roughness={0.35} metalness={0.6} emissive="#0a1428" emissiveIntensity={0.6} />;
  const ledAngles = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2), []);
  return (
    <group>
      {/* port node: a short cylinder along z, its face at z = 0 */}
      <mesh position={[0, 0, -3.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.9, 1.9, 7, 32]} />
        {hull}
      </mesh>
      {/* the docking collar and ring */}
      <mesh position={[0, 0, -0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.45, 1.6, 0.7, 40, 1, true]} />
        <meshStandardMaterial color="#e3e7e9" roughness={0.4} metalness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <torusGeometry args={[1.3, 0.12, 12, 48]} />
        <meshStandardMaterial color="#f4f6f7" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* the aim cross in the middle of the port */}
      <mesh position={[0, 0, -0.5]}>
        <boxGeometry args={[1.6, 0.1, 0.05]} />
        <meshBasicMaterial color="#5ee9d4" />
      </mesh>
      <mesh position={[0, 0, -0.5]}>
        <boxGeometry args={[0.1, 1.6, 0.05]} />
        <meshBasicMaterial color="#5ee9d4" />
      </mesh>
      {/* alignment lights around the ring */}
      {ledAngles.map((a) => (
        <mesh key={a} position={[Math.cos(a) * 1.62, Math.sin(a) * 1.62, 0.08]}>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshBasicMaterial ref={a === 0 ? leds : undefined} color="#4ade80" transparent />
        </mesh>
      ))}
      {/* central module */}
      <mesh position={[0, 0, -16]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3.4, 3.4, 18, 40]} />
        {hull}
      </mesh>
      <mesh position={[0, 0, -7.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.4, 3.4, 2.4, 40]} />
        {dark}
      </mesh>
      {/* the truss across the module, with solar arrays on both sides */}
      <mesh position={[0, 0, -14]}>
        <boxGeometry args={[78, 0.9, 0.9]} />
        {dark}
      </mesh>
      {[-1, 1].flatMap((side) =>
        [26, 44].map((x) => (
          <mesh key={`${side}${x}`} position={[side * x, 0, -14]}>
            <boxGeometry args={[14, 0.12, 8.5]} />
            {panel}
          </mesh>
        )),
      )}
      {/* radiators and a dish, for scale and silhouette */}
      <mesh position={[0, 5.2, -20]}>
        <boxGeometry args={[0.15, 7, 10]} />
        <meshStandardMaterial color="#e8ecee" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, -4.6, -22]} rotation={[Math.PI * 0.28, 0, 0]}>
        <coneGeometry args={[3.2, 1, 28, 1, true]} />
        <meshStandardMaterial color="#d6dadc" roughness={0.45} metalness={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* habitat ring behind the module, turning slowly */}
      <group ref={ring} position={[0, 0, -34]}>
        <mesh>
          <torusGeometry args={[15, 2.1, 20, 72]} />
          {hull}
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
            <boxGeometry args={[30, 0.5, 0.5]} />
            {dark}
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0, -26]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.4, 1.4, 16, 20]} />
        {dark}
      </mesh>
    </group>
  );
}

// A glow on the port that can be seen from far away, and fades as the real
// ring becomes big enough to see for itself.
function Beacon() {
  const tex = useMemo(() => glowTexture(), []);
  return (
    <sprite position={[0, 0, 1]} scale={[10, 10, 1]}>
      <spriteMaterial map={tex} color="#5ee9d4" transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
}

function Approach({ inputs, onHud }: { inputs: React.RefObject<DockingInputs>; onHud: (h: DockHud) => void }) {
  const sim = useRef<Dock>(newDock());
  const state = useRef({ hudT: 0, t: 0, shake: 0, wasDone: false });
  const keys = useRef({ w: 0, s: 0, a: 0, d: 0, up: 0, down: 0, left: 0, right: 0 });
  const { camera } = useThree();
  const euler = useMemo(() => new THREE.Euler(), []);
  const goalQ = useMemo(() => new THREE.Quaternion(), []);
  const sun = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    const map: Record<string, keyof typeof keys.current> = { w: 'w', s: 's', a: 'a', d: 'd', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
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
    const dt = Math.min(rawDt, 0.06);
    const s = state.current;
    const d = sim.current;
    const k = keys.current;
    s.t += dt;

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
    const close = clamp(i.ly + gl.y + k.w - k.s);
    const sx = clamp(i.rx + gr.x + k.right - k.left + k.d - k.a);
    const sy = clamp(i.ry + gr.y + k.up - k.down);

    const steps = Math.max(1, Math.ceil(dt / (1 / 30)));
    for (let n = 0; n < steps; n++) stepDock(d, { close, sx, sy, assist: i.assist ?? true }, dt / steps);

    const done = d.phase === 'docked' || d.phase === 'crashed';
    if (done && !s.wasDone) {
      s.wasDone = true;
      s.shake = d.phase === 'crashed' ? 1 : 0.2;
    }
    s.shake = Math.max(0, s.shake - dt * 0.9);

    // The drone looks straight down the approach axis. A little breathing and,
    // on contact, a shake; thruster firings tilt the view a touch.
    const jx = (Math.sin(s.t * 83) + Math.sin(s.t * 47)) * s.shake * 0.02;
    const jy = (Math.sin(s.t * 67) + Math.sin(s.t * 39)) * s.shake * 0.02;
    euler.set(d.ty * 0.012 + jx + Math.sin(s.t * 0.5) * 0.0015, -d.tx * 0.012 + jy + Math.sin(s.t * 0.37 + 1) * 0.0015, -d.tx * 0.02 + Math.sin(s.t * 0.7) * 0.002, 'YXZ');
    goalQ.setFromEuler(euler);
    camera.quaternion.slerp(goalQ, 1 - Math.exp(-dt * 5));
    camera.position.set(d.x, d.y, d.z + 1.2);
    if (sun.current) {
      sun.current.position.copy(SUN_DIR).multiplyScalar(300);
      sun.current.target.position.set(0, 0, -15);
      sun.current.target.updateMatrixWorld();
    }

    s.hudT += dt;
    if (s.hudT > 0.1 || (done && s.hudT > 0.02)) {
      s.hudT = 0;
      onHud({
        t: d.t,
        phase: d.phase,
        range: Math.max(0, d.z),
        closing: -d.vz,
        allowed: speedCorridor(d.z),
        x: d.x,
        y: d.y,
        offset: Math.hypot(d.x, d.y),
        vx: d.vx,
        vy: d.vy,
        sway: Math.hypot(d.vx, d.vy),
        fuel: d.fuel,
        assisting: (i.assist ?? true) && Math.abs(d.tx) < 0.05 && Math.abs(d.ty) < 0.05 && !done,
        result: d.result,
      });
    }
  });

  return (
    <>
      <color attach="background" args={['#00020a']} />
      <ambientLight intensity={0.28} />
      <hemisphereLight args={['#9db8e8', '#10131a', 0.25]} />
      <directionalLight ref={sun} intensity={3} />
      <Stars radius={20000} depth={3000} count={6000} factor={900} fade={false} speed={0} />
      <Planet />
      <Station />
      <Beacon />
    </>
  );
}

export default function DockingScene({ inputs, onHud }: { inputs: React.RefObject<DockingInputs>; onHud: (h: DockHud) => void }) {
  return (
    <Canvas camera={{ position: [14, -8, 121.2], fov: 55, near: 0.05, far: 60000 }} dpr={[1, 2]}>
      <Approach inputs={inputs} onHud={onHud} />
    </Canvas>
  );
}
