'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { newDescent, stepDescent, viewPitch, T_MAX } from '@/lib/astroSim/touchdown';
import type { Descent, Phase, Result } from '@/lib/astroSim/touchdown';

// Mission 02, Lunar Touchdown: the pilot's view of the descent. The ground is a
// procedurally cratered surface (no photographs: it is a stand-in, not a real
// site), with fine detail added in the shader, rocks that cast shadows, a small
// base for scale, the landing marker, and the Earth in the sky.

export interface LandingInputs {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  assist?: boolean;
}

export interface LandingHud {
  t: number;
  phase: Phase;
  p: number;
  /** radar altitude, m */
  alt: number;
  /** vertical speed, m/s, up positive */
  vy: number;
  /** ground speed, m/s */
  drift: number;
  vx: number;
  vz: number;
  x: number;
  z: number;
  siteDist: number;
  fuel: number;
  thr: number;
  assisting: boolean;
  result: Result | null;
}

export const EMPTY_LANDING_HUD: LandingHud = {
  t: 0, phase: 'braking', p: 0, alt: 15240, vy: 0, drift: 1680, vx: 0, vz: -1680, x: 0, z: 41000, siteDist: 41000, fuel: 100, thr: 0.8, assisting: false, result: null,
};

const SUN_DIR = new THREE.Vector3(-0.78, 0.36, 0.5).normalize();
const EYE = 3; // m above the radar altitude: the pilot's eye
const TILE = 4096; // m covered by one coarse terrain tile
const PLANE = 400000;

// ------------------------------------------------------------ procedural art

function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 1024px tile of soft craters, seamless when repeated. */
function makeTerrainCanvases() {
  const S = 1024;
  const rnd = prng(20260726);
  const make = () => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return c;
  };
  const col = make();
  const cc = col.getContext('2d')!;
  cc.fillStyle = '#8b8883';
  cc.fillRect(0, 0, S, S);

  const wrap = (fn: (ox: number, oy: number) => void) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy);
  };
  const blob = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner: string, outer: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };

  // soft albedo patches
  for (let i = 0; i < 420; i++) {
    const x = rnd() * S, y = rnd() * S, r = 18 + rnd() * 130;
    const light = rnd() > 0.5;
    wrap((ox, oy) => blob(cc, x + ox, y + oy, r, light ? 'rgba(255,252,245,0.05)' : 'rgba(30,28,26,0.07)', 'rgba(0,0,0,0)'));
  }
  // craters, big and many small, each with a raised rim and a shaded bowl
  for (let i = 0; i < 190; i++) {
    const r = 9 + Math.pow(rnd(), 3) * 120;
    const x = rnd() * S, y = rnd() * S;
    wrap((ox, oy) => {
      const cx = x + ox, cy = y + oy;
      if (cx < -r * 1.4 || cx > S + r * 1.4 || cy < -r * 1.4 || cy > S + r * 1.4) return;
      // colour: bright rim ring, darker bowl shifted away from the sun
      const rim = cc.createRadialGradient(cx, cy, r * 0.72, cx, cy, r * 1.3);
      rim.addColorStop(0, 'rgba(255,250,240,0)');
      rim.addColorStop(0.45, 'rgba(255,250,240,0.2)');
      rim.addColorStop(1, 'rgba(255,250,240,0)');
      cc.fillStyle = rim;
      cc.fillRect(cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6);
      blob(cc, cx + r * 0.1, cy + r * 0.1, r * 0.9, 'rgba(25,23,21,0.38)', 'rgba(25,23,21,0)');
    });
  }
  return col;
}

/** Fine regolith grain: smooth multi-scale noise that tiles, plus a little pixel grain. */
function makeDetailCanvas() {
  const S = 256;
  const rnd = prng(7);
  const octaves = [
    { n: 8, a: 0.4 },
    { n: 16, a: 0.28 },
    { n: 32, a: 0.2 },
    { n: 64, a: 0.12 },
  ].map((o) => ({ ...o, lat: Array.from({ length: o.n * o.n }, () => rnd()) }));
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(S, S);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let v = 0;
      for (const o of octaves) {
        const u = (x / S) * o.n, w = (y / S) * o.n;
        const x0 = Math.floor(u), y0 = Math.floor(w);
        const fx = smooth(u - x0), fy = smooth(w - y0);
        const x1 = (x0 + 1) % o.n, y1 = (y0 + 1) % o.n;
        const a = o.lat[y0 * o.n + x0], b = o.lat[y0 * o.n + x1], c2 = o.lat[y1 * o.n + x0], d = o.lat[y1 * o.n + x1];
        v += o.a * (a + (b - a) * fx + (c2 - a) * fy + (a - b - c2 + d) * fx * fy);
      }
      v += (rnd() - 0.5) * 0.1;
      const g = Math.max(0, Math.min(255, 45 + 170 * v));
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** A soft round puff for the dust, so it never renders as hard squares. */
function makePuffCanvas() {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return c;
}

function makeEarthCanvas() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const rnd = prng(99);
  ctx.fillStyle = '#1d4e9c';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) {
    const x = rnd() * S, y = rnd() * S, r = 8 + rnd() * 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rnd() > 0.45 ? 'rgba(245,248,255,0.55)' : 'rgba(70,120,60,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}

// ------------------------------------------------------------------ scene bits

function Terrain() {
  const { albedo, detail } = useMemo(() => {
    const a = new THREE.CanvasTexture(makeTerrainCanvases());
    a.colorSpace = THREE.SRGBColorSpace;
    const d = new THREE.CanvasTexture(makeDetailCanvas());
    a.wrapS = a.wrapT = THREE.RepeatWrapping;
    a.repeat.set(PLANE / TILE, PLANE / TILE);
    a.anisotropy = 4;
    d.wrapS = d.wrapT = THREE.RepeatWrapping;
    d.anisotropy = 4;
    return { albedo: a, detail: d };
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
           float w2 = 1.0 - smoothstep(60.0, 500.0, camDist);
           float d1 = texture2D(uDetail, vMapUv * 48.0).r;
           float d2 = texture2D(uDetail, vMapUv * 640.0).r;
           diffuseColor.rgb *= mix(1.0, 0.7 + 0.6 * d1, w1) * mix(1.0, 0.78 + 0.44 * d2, w2);
           // far away the texture is replaced by its average, so it cannot shimmer
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.235, 0.228, 0.215), smoothstep(1200.0, 9000.0, camDist));`,
        );
    },
    [detail],
  );

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[PLANE, PLANE]} />
      <meshStandardMaterial map={albedo} roughness={1} metalness={0} onBeforeCompile={onBeforeCompile} />
    </mesh>
  );
}

const ROCKS = 240;

function Rocks() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const rnd = prng(31337);
    const o = new THREE.Object3D();
    for (let i = 0; i < ROCKS; i++) {
      // clear the pad: nothing within 26 m of the marker
      let x = 0, z = 0;
      do {
        const a = rnd() * Math.PI * 2;
        const r = 12 + Math.pow(rnd(), 0.7) * 260;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
      } while (Math.hypot(x, z) < 26);
      const s = 0.25 + Math.pow(rnd(), 3) * 2.6;
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
      <meshStandardMaterial color="#74716c" roughness={1} flatShading />
    </instancedMesh>
  );
}

// Shackleton Base: a few modules, a dish and a mast, off to one side of the pad.
function Base() {
  const light = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (light.current) light.current.opacity = 0.35 + 0.65 * (Math.sin(clock.elapsedTime * 2.2) > 0.2 ? 1 : 0);
  });
  const white = <meshStandardMaterial color="#d9dcde" roughness={0.6} metalness={0.2} />;
  return (
    <group position={[78, 0, -34]}>
      {[0, 11, 22].map((dx) => (
        <mesh key={dx} position={[dx, 2.6, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[2.6, 2.6, 9, 20]} />
          {white}
        </mesh>
      ))}
      <mesh position={[11, 2.6, -8]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.6, 1.6, 14, 16]} />
        {white}
      </mesh>
      <mesh position={[-8, 3, 6]} rotation={[Math.PI * 0.18, 0, 0]} castShadow>
        <coneGeometry args={[4, 1.4, 24, 1, true]} />
        <meshStandardMaterial color="#c9cdd0" roughness={0.5} metalness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[30, 8, 4]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 16, 8]} />
        {white}
      </mesh>
      <mesh position={[30, 16.4, 4]}>
        <sphereGeometry args={[0.55, 12, 8]} />
        <meshBasicMaterial ref={light} color="#ff5a3c" transparent />
      </mesh>
    </group>
  );
}

// The landing marker: a ring on the ground and a thin beam that shows from far away.
function Marker() {
  const beam = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock, camera }) => {
    // the beam is a long-range marker: it fades out as the pilot closes in
    const near = THREE.MathUtils.smoothstep(camera.position.length(), 40, 400);
    if (beam.current) beam.current.opacity = (0.16 + 0.07 * Math.sin(clock.elapsedTime * 1.4)) * near;
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
      <mesh position={[0, 200, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 400, 8, 1, true]} />
        <meshBasicMaterial ref={beam} color="#5ee9d4" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Earth() {
  const map = useMemo(() => new THREE.CanvasTexture(makeEarthCanvas()), []);
  const pos = useMemo(() => new THREE.Vector3(0.34, 0.4, -0.85).normalize().multiplyScalar(300000), []);
  return (
    <mesh position={pos}>
      <sphereGeometry args={[5000, 32, 24]} />
      <meshBasicMaterial map={map} />
    </mesh>
  );
}

// ------------------------------------------------------------------- the flight

const DUST_N = 260;

function Descent({ inputs, onHud }: { inputs: React.RefObject<LandingInputs>; onHud: (h: LandingHud) => void }) {
  const sim = useRef<Descent>(newDescent());
  const state = useRef({ hudT: 0, t: 0, shake: 0, wasDone: false, sx: 0, sz: 0 });
  const keys = useRef({ w: 0, s: 0, a: 0, d: 0, up: 0, down: 0, left: 0, right: 0 });
  const { camera } = useThree();
  const dust = useRef<THREE.Points>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const euler = useMemo(() => new THREE.Euler(), []);
  const goalQ = useMemo(() => new THREE.Quaternion(), []);
  const dustPos = useMemo(() => new Float32Array(DUST_N * 3), []);
  const puff = useMemo(() => new THREE.CanvasTexture(makePuffCanvas()), []);
  const dustSeed = useMemo(() => {
    const rnd = prng(5);
    return Array.from({ length: DUST_N }, () => ({ a: rnd() * Math.PI * 2, ph: rnd(), sp: 0.7 + rnd() * 0.6, h: rnd() }));
  }, []);

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
    const thrIn = clamp(i.ly + gl.y + k.w - k.s);
    const tx = clamp(i.rx + gr.x + k.right - k.left + k.d - k.a);
    const tz = clamp(i.ry + gr.y + k.up - k.down);

    // fixed small steps keep the descent identical on slow and fast machines
    const steps = Math.max(1, Math.ceil(dt / (1 / 30)));
    for (let n = 0; n < steps; n++) stepDescent(d, { thrIn, tx, tz, assist: i.assist ?? true }, dt / steps);

    const done = d.phase === 'landed' || d.phase === 'crashed';
    if (done && !s.wasDone) {
      s.wasDone = true;
      s.shake = d.phase === 'crashed' ? 1 : 0.25;
    }
    s.shake = Math.max(0, s.shake - dt * 0.7);

    // the pilot's head: pitch-over reveal, stick tilt, engine vibration, impact shake
    const eff = d.fuel > 0 ? d.thr : 0;
    const vib = done ? 0 : 0.0011 * eff;
    const jx = (Math.sin(s.t * 91) + Math.sin(s.t * 57)) * (vib + s.shake * 0.02);
    const jy = (Math.sin(s.t * 73) + Math.sin(s.t * 41)) * (vib + s.shake * 0.02);
    euler.set(viewPitch(d.y) + d.tz * 0.16 + jx + Math.sin(s.t * 0.6) * 0.003, jy + Math.sin(s.t * 0.45 + 1) * 0.0025, -d.tx * 0.12 + Math.sin(s.t * 0.8) * 0.003, 'YXZ');
    goalQ.setFromEuler(euler);
    camera.quaternion.slerp(goalQ, 1 - Math.exp(-dt * 4));
    camera.position.set(d.x, d.y + EYE, d.z);
    if (sun.current) {
      // the shadow box follows the pilot so the rocks around the site always cast shadows
      sun.current.position.set(d.x, 0, d.z).addScaledVector(SUN_DIR, 400);
      sun.current.target.position.set(d.x, 0, d.z);
      sun.current.target.updateMatrixWorld();
    }

    // dust kicked up by the engine near the ground
    const pts = dust.current;
    if (pts) {
      const near = Math.max(0, 1 - d.y / 60) * (done ? 0.0 : eff);
      (pts.material as THREE.PointsMaterial).opacity = Math.min(0.5, near * 0.9);
      pts.visible = near > 0.02;
      if (pts.visible) {
        const pos = (pts.geometry.attributes.position.array as Float32Array);
        for (let n = 0; n < DUST_N; n++) {
          const sd = dustSeed[n];
          const life = (s.t * sd.sp * 0.5 + sd.ph) % 1;
          const r = 4 + life * 70 * (0.6 + near);
          pos[n * 3] = d.x + Math.cos(sd.a) * r;
          pos[n * 3 + 1] = 0.3 + sd.h * (1 + life * 5) * near;
          pos[n * 3 + 2] = d.z + Math.sin(sd.a) * r;
        }
        pts.geometry.attributes.position.needsUpdate = true;
      }
    }

    s.hudT += dt;
    if (s.hudT > 0.1 || (done && s.hudT > 0.02)) {
      s.hudT = 0;
      const lat = Math.hypot(d.tx, d.tz);
      onHud({
        t: d.t,
        phase: d.phase,
        p: d.p,
        alt: Math.max(0, d.y),
        vy: d.vy,
        drift: Math.hypot(d.vx, d.vz),
        vx: d.vx,
        vz: d.vz,
        x: d.x,
        z: d.z,
        siteDist: Math.hypot(d.x, d.z),
        fuel: d.fuel,
        thr: d.thr,
        assisting: (i.assist ?? true) && lat < 0.05 && d.phase !== 'braking' && !done,
        result: d.result,
      });
    }
  });

  return (
    <>
      <color attach="background" args={['#000004']} />
      <ambientLight intensity={0.22} />
      <directionalLight
        ref={sun}
        intensity={2.5}
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
      <Stars radius={500000} depth={4000} count={7000} factor={600} fade={false} speed={0} />
      <Earth />
      <Terrain />
      <Rocks />
      <Base />
      <Marker />
      <points ref={dust} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustPos, 3]} />
        </bufferGeometry>
        <pointsMaterial map={puff} size={3} color="#b4b0a8" transparent opacity={0} depthWrite={false} sizeAttenuation />
      </points>
    </>
  );
}

export default function LandingScene({ inputs, onHud }: { inputs: React.RefObject<LandingInputs>; onHud: (h: LandingHud) => void }) {
  return (
    <Canvas camera={{ position: [0, 15000, 41000], fov: 55, near: 0.3, far: 700000 }} dpr={[1, 2]} shadows>
      <Descent inputs={inputs} onHud={onHud} />
    </Canvas>
  );
}

// the full-throttle pull of the engine, for the HUD's g-load readout
export const THRUST_G = T_MAX / 9.80665;
