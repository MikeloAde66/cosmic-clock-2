'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { CABLE, R_MARS, ROVER_HANG, X_TARGET, newMars, predictEntry, stepMars } from '@/lib/astroSim/mars';
import type { Mars, Phase, Result } from '@/lib/astroSim/mars';

// Mission 04, Mars Sky-Crane Landing: the pilot's view from entry to the cord cut.
// The planet is a textured sphere with a thin haze shell; the landing area is a
// patch of the same sphere with procedural ground, rocks, a marker, a parachute
// and the rover on its cables. No photographs: it is a stand-in, not a real site.

export interface MarsInputs {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  assist?: boolean;
  action?: number;
}

export interface MarsHud {
  t: number;
  phase: Phase;
  /** altitude, m */
  alt: number;
  x: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** entry speed, m/s */
  speed: number;
  g: number;
  peakG: number;
  lift: number;
  fuel: number;
  thr: number;
  cable: number;
  swing: number;
  down: boolean;
  /** distance from the marker, m */
  siteDist: number;
  /** ground speed in the powered descent, m/s */
  drift: number;
  /** entry predictor: where holding the lift setting would land, and how fast the chute would open */
  predX: number | null;
  predSpeed: number | null;
  /** predicted range error, m, positive = long */
  rangeErr: number | null;
  result: Result | null;
}

export const EMPTY_MARS_HUD: MarsHud = {
  t: 0, phase: 'entry', alt: 125000, x: 0, z: 0, vx: 5600, vy: -1500, vz: 0, speed: 5800, g: 0, peakG: 0, lift: 0.5, fuel: 100, thr: 0, cable: 0, swing: 0, down: false,
  siteDist: 0, drift: 0, predX: null, predSpeed: null, rangeErr: null, result: null,
};

const SUN_DIR = new THREE.Vector3(-0.35, 0.62, -0.5).normalize();
const SKY_LOW = new THREE.Color('#c58a62');
const SKY_HIGH = new THREE.Color('#00020a');
export const TILE = 3000;
const CAP = 120000; // m half-width of the landing patch

export function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** The whole planet: rust and tan with dark regions and a polar cap. */
function planetTexture() {
  const c = canvas(1024, 512);
  const g = c.getContext('2d')!;
  g.fillStyle = '#b8764d';
  g.fillRect(0, 0, 1024, 512);
  const rnd = prng(4);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * 1024, y = 40 + rnd() * 432, r = 14 + rnd() * 70;
    const dark = rnd() > 0.45;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, dark ? 'rgba(70,40,28,0.35)' : 'rgba(235,190,140,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const cap = g.createLinearGradient(0, 0, 0, 512);
  cap.addColorStop(0, 'rgba(245,240,235,0.95)');
  cap.addColorStop(0.06, 'rgba(245,240,235,0)');
  cap.addColorStop(0.94, 'rgba(245,240,235,0)');
  cap.addColorStop(1, 'rgba(245,240,235,0.95)');
  g.fillStyle = cap;
  g.fillRect(0, 0, 1024, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A 1024px tile of rusty ground with soft craters, seamless when repeated. */
export function groundTexture() {
  const S = 1024;
  const c = canvas(S, S);
  const g = c.getContext('2d')!;
  g.fillStyle = '#a4623e';
  g.fillRect(0, 0, S, S);
  const rnd = prng(20260);
  const wrap = (fn: (ox: number, oy: number) => void) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy);
  };
  const blob = (x: number, y: number, r: number, inner: string) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (let i = 0; i < 380; i++) {
    const x = rnd() * S, y = rnd() * S, r = 18 + rnd() * 120;
    const light = rnd() > 0.5;
    wrap((ox, oy) => blob(x + ox, y + oy, r, light ? 'rgba(235,170,120,0.07)' : 'rgba(60,30,20,0.09)'));
  }
  for (let i = 0; i < 150; i++) {
    const r = 9 + Math.pow(rnd(), 3) * 110;
    const x = rnd() * S, y = rnd() * S;
    wrap((ox, oy) => {
      const cx = x + ox, cy = y + oy;
      if (cx < -r * 1.4 || cx > S + r * 1.4 || cy < -r * 1.4 || cy > S + r * 1.4) return;
      const rim = g.createRadialGradient(cx, cy, r * 0.72, cx, cy, r * 1.3);
      rim.addColorStop(0, 'rgba(240,180,130,0)');
      rim.addColorStop(0.45, 'rgba(240,180,130,0.2)');
      rim.addColorStop(1, 'rgba(240,180,130,0)');
      g.fillStyle = rim;
      g.fillRect(cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6);
      blob(cx + r * 0.1, cy + r * 0.1, r * 0.9, 'rgba(45,22,14,0.4)');
    });
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Fine grain: smooth multi-scale noise that tiles. */
export function detailTexture() {
  const S = 256;
  const rnd = prng(7);
  const oct = [
    { n: 8, a: 0.4 },
    { n: 16, a: 0.28 },
    { n: 32, a: 0.2 },
    { n: 64, a: 0.12 },
  ].map((o) => ({ ...o, lat: Array.from({ length: o.n * o.n }, () => rnd()) }));
  const c = canvas(S, S);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(S, S);
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let v = 0;
      for (const o of oct) {
        const u = (x / S) * o.n, w = (y / S) * o.n;
        const x0 = Math.floor(u), y0 = Math.floor(w);
        const fx = sm(u - x0), fy = sm(w - y0);
        const x1 = (x0 + 1) % o.n, y1 = (y0 + 1) % o.n;
        const a = o.lat[y0 * o.n + x0], b = o.lat[y0 * o.n + x1], c2 = o.lat[y1 * o.n + x0], d = o.lat[y1 * o.n + x1];
        v += o.a * (a + (b - a) * fx + (c2 - a) * fy + (a - b - c2 + d) * fx * fy);
      }
      v += (rnd() - 0.5) * 0.1;
      const gr = Math.max(0, Math.min(255, 45 + 170 * v));
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = gr;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function chuteTexture() {
  const c = canvas(256, 64);
  const g = c.getContext('2d')!;
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? '#f4f1ec' : '#d9512c';
    g.fillRect(i * 16, 0, 16, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function puffTexture() {
  const c = canvas(64, 64);
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ------------------------------------------------------------------ scene bits

function Planet({ shell }: { shell: React.RefObject<THREE.Mesh | null> }) {
  const map = useMemo(() => planetTexture(), []);
  return (
    <group position={[0, -R_MARS, 0]}>
      <mesh rotation={[0, 0, 0]}>
        <sphereGeometry args={[R_MARS - 400, 160, 96]} />
        <meshStandardMaterial map={map} roughness={1} metalness={0} />
      </mesh>
      {/* a thin shell of haze: the glow around the limb seen from orbit */}
      <mesh ref={shell}>
        <sphereGeometry args={[R_MARS + 70000, 96, 64]} />
        <meshBasicMaterial color="#e0996b" transparent opacity={0.16} side={THREE.BackSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

/** The landing patch: a cap of the same sphere, with planar texture coordinates. */
export function Ground() {
  const { geo, albedo, detail } = useMemo(() => {
    const g = new THREE.SphereGeometry(R_MARS, 96, 96, 0, Math.PI * 2, 0, CAP / R_MARS);
    g.translate(0, -R_MARS, 0);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / TILE, pos.getZ(i) / TILE);
    uv.needsUpdate = true;
    return { geo: g, albedo: groundTexture(), detail: detailTexture() };
  }, []);

  const onBeforeCompile = useMemo(
    () => (shader: { uniforms: Record<string, THREE.IUniform>; fragmentShader: string }) => {
      shader.uniforms.uDetail = { value: detail };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;')
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           float camDist = length(vViewPosition);
           float w1 = 1.0 - smoothstep(600.0, 4000.0, camDist);
           float w2 = 1.0 - smoothstep(40.0, 400.0, camDist);
           float d1 = texture2D(uDetail, vMapUv * 48.0).r;
           float d2 = texture2D(uDetail, vMapUv * 640.0).r;
           diffuseColor.rgb *= mix(1.0, 0.7 + 0.6 * d1, w1) * mix(1.0, 0.78 + 0.44 * d2, w2);
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.3, 0.21), smoothstep(1500.0, 12000.0, camDist));`,
        );
    },
    [detail],
  );
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial map={albedo} roughness={1} metalness={0} onBeforeCompile={onBeforeCompile} />
    </mesh>
  );
}

const ROCKS = 260;

function Rocks() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const rnd = prng(31337);
    const o = new THREE.Object3D();
    for (let i = 0; i < ROCKS; i++) {
      let x = 0, z = 0;
      do {
        const a = rnd() * Math.PI * 2;
        const r = 12 + Math.pow(rnd(), 0.7) * 300;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
      } while (Math.hypot(x, z) < 24);
      const s = 0.25 + Math.pow(rnd(), 3) * 2.8;
      o.position.set(x, s * 0.3, z);
      o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      o.scale.set(s * (0.8 + rnd() * 0.6), s * (0.5 + rnd() * 0.5), s * (0.8 + rnd() * 0.6));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, ROCKS]} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#6e4a3a" roughness={1} flatShading />
    </instancedMesh>
  );
}

/** The landing marker: a ring on the ground and a long-range beam that fades as the pilot closes in. */
function Marker() {
  const beam = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock, camera }) => {
    const near = THREE.MathUtils.smoothstep(camera.position.length(), 60, 600);
    if (beam.current) beam.current.opacity = (0.2 + 0.08 * Math.sin(clock.elapsedTime * 1.4)) * near;
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <ringGeometry args={[15.5, 17.5, 64]} />
        <meshBasicMaterial color="#5ee9d4" transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[58, 60, 96]} />
        <meshBasicMaterial color="#5ee9d4" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, 600, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 1200, 8, 1, true]} />
        <meshBasicMaterial ref={beam} color="#5ee9d4" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** The parachute: a striped dome above the drone, with its lines. */
function Chute({ group }: { group: React.RefObject<THREE.Group | null> }) {
  const tex = useMemo(() => chuteTexture(), []);
  const lines = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      pts.push(0, 0, 0, Math.cos(a) * 9.6, 30, Math.sin(a) * 9.6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <group ref={group} visible={false}>
      <mesh position={[0, 30, 0]}>
        <sphereGeometry args={[10, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
        <meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.9} emissive="#3a1a10" emissiveIntensity={0.25} />
      </mesh>
      <lineSegments geometry={lines}>
        <lineBasicMaterial color="#f0e6dc" />
      </lineSegments>
    </group>
  );
}

/** The rover, hanging on three cables from the descent stage. */
function Rover({ group, cables }: { group: React.RefObject<THREE.Group | null>; cables: React.RefObject<THREE.LineSegments | null> }) {
  const body = <meshStandardMaterial color="#d8dadc" roughness={0.55} metalness={0.35} />;
  const dark = <meshStandardMaterial color="#2b2f33" roughness={0.8} metalness={0.3} />;
  const wheels = useMemo(() => [-1, 0, 1].flatMap((i) => [-1, 1].map((s) => [i * 0.85, 0.28, s * 1.05] as const)), []);
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(18), 3));
    return g;
  }, []);
  return (
    <>
      <group ref={group} visible={false}>
        <mesh position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[2.3, 0.7, 1.7]} />
          {body}
        </mesh>
        <mesh position={[0, 1.55, 0.2]} castShadow>
          <boxGeometry args={[0.5, 0.8, 0.12]} />
          {dark}
        </mesh>
        <mesh position={[0.1, 2.0, 0.2]}>
          <boxGeometry args={[0.45, 0.22, 0.2]} />
          {body}
        </mesh>
        <mesh position={[-1.1, 1.0, 0.7]} rotation={[0, 0, 0.7]}>
          <boxGeometry args={[0.1, 0.8, 0.1]} />
          {dark}
        </mesh>
        {wheels.map((p, i) => (
          <mesh key={i} position={[p[0], p[1], p[2]]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.24, 18]} />
            {dark}
          </mesh>
        ))}
        {[[-0.8, -0.55], [0.8, -0.55], [0, 0.65]].map((p, i) => (
          <mesh key={i} position={[p[0], 1.3, p[1] * 0.9]}>
            <sphereGeometry args={[0.08, 8, 6]} />
            <meshBasicMaterial color="#f3e8d8" />
          </mesh>
        ))}
      </group>
      <lineSegments ref={cables} geometry={lineGeo} visible={false} frustumCulled={false}>
        <lineBasicMaterial color="#e9e1d6" />
      </lineSegments>
    </>
  );
}

const DUST_N = 160;

function Flight({ inputs, onHud }: { inputs: React.RefObject<MarsInputs>; onHud: (h: MarsHud) => void }) {
  const sim = useRef<Mars>(newMars());
  const state = useRef({ hudT: 0, t: 0, shake: 0, wasDone: false, lastAction: 0, actionPending: false, endT: 0, pitch: 0.2 });
  const keys = useRef({ w: 0, s: 0, a: 0, d: 0, up: 0, down: 0, left: 0, right: 0 });
  const { camera } = useThree();
  const bg = useRef<THREE.Color>(null);
  const fogRef = useRef<THREE.FogExp2>(null);
  const chute = useRef<THREE.Group>(null);
  const rover = useRef<THREE.Group>(null);
  const cables = useRef<THREE.LineSegments>(null);
  const stars = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Mesh>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const dust = useRef<THREE.Points>(null);
  const dummy = useMemo(() => new THREE.Camera(), []); // a camera, so lookAt points its -Z at the target
  const goalQ = useMemo(() => new THREE.Quaternion(), []);
  const dustPos = useMemo(() => new Float32Array(DUST_N * 3), []);
  const puff = useMemo(() => puffTexture(), []);
  const dustSeed = useMemo(() => {
    const rnd = prng(5);
    return Array.from({ length: DUST_N }, () => ({ a: rnd() * Math.PI * 2, ph: rnd(), sp: 0.7 + rnd() * 0.6, h: rnd() }));
  }, []);

  useEffect(() => {
    const map: Record<string, keyof typeof keys.current> = { w: 'w', s: 's', a: 'a', d: 'd', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (e.key === ' ' || e.key === 'Enter') {
        state.current.actionPending = true;
        e.preventDefault();
        return;
      }
      const k = map[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (k) {
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
    const lift = clamp(i.ly + i.ry + gl.y + gr.y + k.w - k.s + k.up - k.down);
    const thrIn = clamp(i.ly + gl.y + k.w - k.s);
    const fwd = clamp(i.ry + gr.y + k.up - k.down);
    const right = clamp(i.rx + gr.x + k.right - k.left + k.d - k.a);
    if (i.action && i.action !== s.lastAction) {
      s.lastAction = i.action;
      s.actionPending = true;
    }

    const steps = Math.max(1, Math.ceil(dt / (1 / 30)));
    for (let n = 0; n < steps; n++) {
      stepMars(d, { lift, thrIn, tx: fwd, tz: right, assist: i.assist ?? true, action: s.actionPending && n === 0 }, dt / steps);
    }
    s.actionPending = false;

    const done = d.phase === 'landed' || d.phase === 'crashed';
    if (done && !s.wasDone) {
      s.wasDone = true;
      s.shake = d.phase === 'crashed' ? 1 : 0.15;
    }
    if (done) s.endT += dt;
    s.shake = Math.max(0, s.shake - dt * 0.8);
    const inEntry = d.phase === 'entry' || (d.phase === 'crashed' && d.x > 1e5);

    // sky and haze follow the altitude
    const hiMix = THREE.MathUtils.smoothstep(d.y, 3000, 45000);
    bg.current?.copy(SKY_LOW).lerp(SKY_HIGH, hiMix);
    if (fogRef.current) {
      fogRef.current.density = 0.00007 * (1 - THREE.MathUtils.smoothstep(d.y, 6000, 40000));
      fogRef.current.color.copy(SKY_LOW);
    }

    // where the drone is, and where it looks
    const pos = new THREE.Vector3();
    const target = new THREE.Vector3();
    if (inEntry) {
      const th = d.x / R_MARS;
      const r = R_MARS + d.y;
      pos.set(r * Math.sin(th), r * Math.cos(th) - R_MARS, 0);
      // look a little below the planet's limb, so the limb sits in the upper part of the window
      const dip = Math.acos(R_MARS / r);
      const a = th + dip + 0.12;
      target.set(pos.x + Math.cos(a) * 200, pos.y - Math.sin(a) * 200, 0);
    } else {
      let pitch: number;
      if (d.phase === 'chute') pitch = 0.7;
      else if (d.phase === 'powered') pitch = -THREE.MathUtils.lerp(0.55, 1.2, 1 - THREE.MathUtils.smoothstep(d.y, 40, 600));
      else pitch = -1.45;
      if (done && d.phase === 'landed') pitch = -0.7;
      s.pitch += (pitch - s.pitch) * (1 - Math.exp(-dt * 1.6));
      const lift2 = d.phase === 'landed' ? s.endT * 3 : 0;
      pos.set(d.x - (d.phase === 'landed' ? s.endT * 1.5 : 0), d.y + lift2, d.z);
      target.set(pos.x + Math.cos(s.pitch) * 100, pos.y + Math.sin(s.pitch) * 100, pos.z);
      if (d.phase === 'landed') target.set(d.x, 1, d.z);
    }
    const eff = d.fuel > 0 && (d.phase === 'powered' || d.phase === 'crane') ? d.thr : 0;
    const vib = 0.0012 * eff + s.shake * 0.02;
    dummy.position.copy(pos);
    dummy.lookAt(target);
    dummy.rotateZ(Math.sin(s.t * 0.6) * 0.003 + (d.phase === 'chute' ? Math.sin(s.t * 0.9) * 0.02 : 0));
    dummy.rotateX((Math.sin(s.t * 91) + Math.sin(s.t * 57)) * vib);
    dummy.rotateY((Math.sin(s.t * 73) + Math.sin(s.t * 41)) * vib);
    goalQ.copy(dummy.quaternion);
    camera.position.copy(pos);
    camera.quaternion.slerp(goalQ, 1 - Math.exp(-dt * (inEntry ? 6 : 3)));

    if (stars.current) {
      stars.current.position.copy(pos);
      stars.current.visible = d.y > 25000; // daylight sky below this
    }
    // the haze shell is seen from outside only: from inside the air it would wash the whole view
    if (shell.current) shell.current.visible = d.y > 80000;
    if (sun.current) {
      sun.current.position.set(pos.x, 0, pos.z).addScaledVector(SUN_DIR, 400);
      sun.current.target.position.set(pos.x, 0, pos.z);
      sun.current.target.updateMatrixWorld();
    }

    // the parachute rides above the drone until the backshell lets go
    if (chute.current) {
      chute.current.visible = d.phase === 'chute';
      chute.current.position.set(d.x + 22, d.y - 8, d.z);
    }

    // the rover and its cables
    const dropping = d.phase === 'crane' || d.phase === 'landed' || (d.phase === 'crashed' && d.cable > 0);
    if (rover.current && cables.current) {
      rover.current.visible = d.phase === 'powered' || dropping;
      const hang = Math.min(d.cable + ROVER_HANG, d.y - 0.1);
      const ry = d.phase === 'powered' ? d.y - ROVER_HANG : Math.max(0, d.y - hang);
      const on = d.phase === 'landed' ? 0 : ry;
      rover.current.position.set(d.x, Math.max(0.0, on), d.z);
      cables.current.visible = d.phase === 'crane' || (d.phase === 'crashed' && d.cable > 0);
      if (cables.current.visible) {
        const a = cables.current.geometry.attributes.position as THREE.BufferAttribute;
        const top = d.y - 0.3;
        const bot = ry + 1.3;
        [[-0.8, -0.5], [0.8, -0.5], [0, 0.6]].forEach(([ox, oz], n) => {
          a.setXYZ(n * 2, d.x + ox * 0.3, top, d.z + oz * 0.3);
          a.setXYZ(n * 2 + 1, d.x + ox, bot, d.z + oz * 0.9);
        });
        a.needsUpdate = true;
      }
      if (d.phase === 'powered') rover.current.visible = false; // stowed under the stage: out of the pilot's view
    }

    // dust blown up by the engines near the ground
    const pts = dust.current;
    if (pts) {
      const near = Math.max(0, 1 - d.y / 50) * (done ? 0 : eff);
      (pts.material as THREE.PointsMaterial).opacity = Math.min(0.5, near * 1.1);
      pts.visible = near > 0.02;
      if (pts.visible) {
        const pa = pts.geometry.attributes.position.array as Float32Array;
        for (let n = 0; n < DUST_N; n++) {
          const sd = dustSeed[n];
          const life = (s.t * sd.sp * 0.5 + sd.ph) % 1;
          const r = 3 + life * 40 * (0.6 + near);
          pa[n * 3] = d.x + Math.cos(sd.a) * r;
          pa[n * 3 + 1] = 0.3 + sd.h * (1 + life * 5) * near;
          pa[n * 3 + 2] = d.z + Math.sin(sd.a) * r;
        }
        pts.geometry.attributes.position.needsUpdate = true;
      }
    }

    s.hudT += dt;
    if (s.hudT > 0.1 || (done && s.hudT > 0.02)) {
      s.hudT = 0;
      let predX: number | null = null;
      let predSpeed: number | null = null;
      if (d.phase === 'entry') {
        const p = predictEntry(d, d.lift, false);
        if (p) {
          predX = p.x;
          predSpeed = p.speed;
        }
      }
      onHud({
        t: d.t,
        phase: d.phase,
        alt: Math.max(0, d.y),
        x: d.x,
        z: d.z,
        vx: d.vx,
        vy: d.vy,
        vz: d.vz,
        speed: d.speed,
        g: d.g,
        peakG: d.peakG,
        lift: d.lift,
        fuel: d.fuel,
        thr: d.thr,
        cable: d.cable,
        swing: d.swing,
        down: d.downAt !== null,
        siteDist: Math.hypot(d.x, d.z),
        drift: Math.hypot(d.vx, d.vz),
        predX,
        predSpeed,
        rangeErr: predX === null ? null : predX - X_TARGET,
        result: d.result,
      });
    }
  });

  return (
    <>
      <color ref={bg} attach="background" args={['#00020a']} />
      <fogExp2 ref={fogRef} attach="fog" args={['#c58a62', 0]} />
      <ambientLight intensity={0.2} color="#ffd9bc" />
      <hemisphereLight args={["#f1c6a0", "#3a1f14", 0.22]} />
      <directionalLight
        ref={sun}
        color="#ffe6cc"
        intensity={1.9}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-170}
        shadow-camera-right={170}
        shadow-camera-top={170}
        shadow-camera-bottom={-170}
        shadow-camera-near={10}
        shadow-camera-far={900}
        shadow-bias={-0.0006}
      />
      <group ref={stars}>
        <Stars radius={500000} depth={4000} count={7000} factor={600} fade={false} speed={0} />
      </group>
      <Planet shell={shell} />
      <Ground />
      <Rocks />
      <Marker />
      <Chute group={chute} />
      <Rover group={rover} cables={cables} />
      <points ref={dust} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustPos, 3]} />
        </bufferGeometry>
        <pointsMaterial map={puff} size={3} color="#c9926a" transparent opacity={0} depthWrite={false} sizeAttenuation />
      </points>
    </>
  );
}

export default function MarsScene({ inputs, onHud }: { inputs: React.RefObject<MarsInputs>; onHud: (h: MarsHud) => void }) {
  return (
    <Canvas camera={{ position: [0, 125000, 0], fov: 55, near: 0.3, far: 20000000 }} dpr={[1, 2]} shadows gl={{ logarithmicDepthBuffer: true }}>
      <Flight inputs={inputs} onHud={onHud} />
    </Canvas>
  );
}

export const CRANE_CABLE = CABLE;
