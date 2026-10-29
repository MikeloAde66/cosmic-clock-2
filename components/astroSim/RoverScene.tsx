'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CRATERS, PITS, RELAY, ROCKS, TARGETS, distTo, inPit, nearestHazard, newRover, nextTarget, stepRover, terrainH, SAMPLE_R, RELAY_R, SAMPLE_T, UPLINK_T } from '@/lib/astroSim/rover';
import type { Activity, HazardKind, Phase, Result, Rover } from '@/lib/astroSim/rover';
import { Ground, TILE, detailTexture, groundTexture, prng } from './MarsScene';

// Mission 05, First Rover Drive: a chase camera behind rover Wren on the same
// procedural Mars ground as the landing. Boulders, sand pits, craters, the
// science targets and the relay point are all drawn here; no photographs.

export interface RoverInputs {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  assist?: boolean;
  action?: number;
}

export interface RoverHud {
  t: number;
  phase: Phase;
  x: number;
  z: number;
  /** radians; forward is (cos, sin) in (x, z) */
  heading: number;
  /** signed speed, m/s */
  v: number;
  battery: number;
  damage: number;
  tilt: number;
  samples: boolean[];
  activity: Activity;
  /** 0..1 through the current activity */
  actFrac: number;
  nextName: string;
  nextDist: number;
  /** angle from the nose to the next stop, radians, positive = to the right */
  nextBearing: number;
  relay: boolean;
  inRange: boolean;
  inPit: boolean;
  hazard: HazardKind | null;
  sink: number;
  distance: number;
  uplinked: boolean;
  result: Result | null;
}

export const EMPTY_ROVER_HUD: RoverHud = {
  t: 0, phase: 'stowed', x: 0, z: 0, heading: 0, v: 0, battery: 100, damage: 0, tilt: 0, samples: [false, false, false], activity: 'none', actFrac: 0,
  nextName: TARGETS[0].name, nextDist: Math.hypot(TARGETS[0].x, TARGETS[0].z), nextBearing: 0, relay: false, inRange: false, inPit: false, hazard: null, sink: 0, distance: 0,
  uplinked: false, result: null,
};

const SUN_DIR = new THREE.Vector3(-0.35, 0.62, -0.5).normalize();
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#5d4a5e');
  grad.addColorStop(0.35, '#a0706a');
  grad.addColorStop(0.5, '#d9a07a');
  grad.addColorStop(1, '#d9a07a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function softDisc(inner: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.75, inner);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ------------------------------------------------------------------ the land

function Sky({ group }: { group: React.RefObject<THREE.Group | null> }) {
  const map = useMemo(() => skyTexture(), []);
  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[9000, 24, 16]} />
        <meshBasicMaterial map={map} side={THREE.BackSide} fog={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Small stones to drive over, with no collision, plus the big boulders that are in the way. */
function Rocks() {
  const pebbles = useRef<THREE.InstancedMesh>(null);
  const boulders = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const o = new THREE.Object3D();
    const p = pebbles.current;
    if (p) {
      const rnd = prng(8801);
      for (let i = 0; i < 600; i++) {
        const x = -60 + rnd() * 220, z = -150 + rnd() * 190;
        const s = 0.08 + Math.pow(rnd(), 2) * 0.3;
        o.position.set(x, s * 0.25, z);
        o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        o.scale.set(s * (0.8 + rnd() * 0.6), s * (0.5 + rnd() * 0.5), s * (0.8 + rnd() * 0.6));
        o.updateMatrix();
        p.setMatrixAt(i, o.matrix);
      }
      p.instanceMatrix.needsUpdate = true;
    }
    const b = boulders.current;
    if (b) {
      const rnd = prng(4242);
      ROCKS.forEach((r, i) => {
        o.position.set(r.x, r.r * 0.45, r.z);
        o.rotation.set(rnd() * 0.5, rnd() * 6, rnd() * 0.5);
        o.scale.set(r.r * (0.95 + rnd() * 0.15), r.r * (0.7 + rnd() * 0.2), r.r * (0.95 + rnd() * 0.15));
        o.updateMatrix();
        b.setMatrixAt(i, o.matrix);
      });
      b.instanceMatrix.needsUpdate = true;
    }
  }, []);
  return (
    <>
      <instancedMesh ref={pebbles} args={[undefined, undefined, 600]} receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#6e4a3a" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={boulders} args={[undefined, undefined, ROCKS.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#5c3d30" roughness={1} flatShading />
      </instancedMesh>
    </>
  );
}

function Pits() {
  const map = useMemo(() => softDisc('rgba(72,38,26,0.9)'), []);
  return (
    <>
      {PITS.map((p, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[p.x, 0.04, p.z]}>
          <circleGeometry args={[p.r * 1.12, 48]} />
          <meshBasicMaterial map={map} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
    </>
  );
}

const PATCH = { x0: -50, x1: 140, z0: -140, z1: 40 };

/**
 * The traverse patch: the same Mars ground, laid just over the big flat one with the
 * craters dug into it, and darkened toward the bottom of each bowl.
 */
function Craters() {
  const { geo, albedo, detail } = useMemo(() => {
    const w = PATCH.x1 - PATCH.x0, h = PATCH.z1 - PATCH.z0;
    const g = new THREE.PlaneGeometry(w, h, w, h);
    g.rotateX(-Math.PI / 2);
    g.translate((PATCH.x0 + PATCH.x1) / 2, 0, (PATCH.z0 + PATCH.z1) / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const deepest = Math.max(...CRATERS.map((c) => c.d));
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = terrainH(x, z);
      pos.setY(i, y + 0.015);
      uv.setXY(i, x / TILE, z / TILE);
      const k = 1 - 0.5 * Math.min(1, -y / (deepest * 0.8));
      col[i * 3] = k;
      col[i * 3 + 1] = k * 0.96;
      col[i * 3 + 2] = k * 0.93;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return { geo: g, albedo: groundTexture(), detail: detailTexture() };
  }, []);
  // the same fine-grain shading as the landing ground
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
    <>
      {/* drawn right after the flat ground and over it, depth ignored, so the bowls show through it */}
      <mesh geometry={geo} receiveShadow renderOrder={-1}>
        <meshStandardMaterial map={albedo} vertexColors roughness={1} metalness={0} onBeforeCompile={onBeforeCompile} depthTest={false} />
      </mesh>
      {/* a hazard line on the rim of the steep crater, like the markers on the targets */}
      {CRATERS.filter((c) => c.d / c.r > 0.3).map((c, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[c.x, 0.15, c.z]}>
          <ringGeometry args={[c.r - 0.3, c.r + 0.3, 72]} />
          <meshBasicMaterial color="#fb7185" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

/** Where Wren came down: the blast marks of the sky crane. */
function LandingScar() {
  const map = useMemo(() => softDisc('rgba(40,22,16,0.55)'), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <circleGeometry args={[11, 48]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

export interface BeaconState {
  /** index of the stop to head for: 0..2 are science targets, 3 is the relay point */
  next: number;
  done: boolean[];
}

/** A beacon on the ground: a ring, a post and a faint beam you can see from far away. The next stop pulses; finished ones go green. */
function Beacon({ x, z, radius, index, state }: { x: number; z: number; radius: number; index: number; state: React.RefObject<BeaconState> }) {
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const beam = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!ring.current || !beam.current) return;
    const done = state.current.done[index];
    const isNext = !done && state.current.next === index;
    const col = done ? '#34d399' : index === 3 ? '#5ee9d4' : '#fbbf24';
    const t = clock.elapsedTime;
    ring.current.color.set(col);
    beam.current.color.set(col);
    ring.current.opacity = done ? 0.5 : isNext ? 0.7 + 0.3 * Math.sin(t * 4) : 0.4;
    beam.current.opacity = done ? 0.06 : isNext ? 0.2 + 0.08 * Math.sin(t * 3) : 0.1;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <ringGeometry args={[radius - 0.35, radius, 48]} />
        <meshBasicMaterial ref={ring} color="#fbbf24" transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1.4, 6]} />
        <meshStandardMaterial color="#e8dccb" />
      </mesh>
      <mesh position={[0, 90, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 180, 8, 1, true]} />
        <meshBasicMaterial ref={beam} color="#fbbf24" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ Wren

const WHEELS: [number, number][] = [-1, 0, 1].flatMap((i) => [-1, 1].map((s) => [i * 0.95, s * 1.05] as [number, number]));

type GroupRef = React.RefObject<THREE.Group | null>;

/** `wheels` holds one child per wheel; each child's first child is the part that spins. */
function Wren({ root, wheels, panelL, panelR, head, arm, dish }: { root: GroupRef; wheels: GroupRef; panelL: GroupRef; panelR: GroupRef; head: GroupRef; arm: GroupRef; dish: GroupRef }) {
  const metal = <meshStandardMaterial color="#d8dadc" roughness={0.55} metalness={0.35} />;
  const dark = <meshStandardMaterial color="#2b2f33" roughness={0.8} metalness={0.3} />;
  const panel = <meshStandardMaterial color="#1f3555" roughness={0.35} metalness={0.5} emissive="#0a1a30" emissiveIntensity={0.4} />;
  return (
    <group ref={root}>
      {/* body */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[2.2, 0.7, 1.5]} />
        {metal}
      </mesh>
      <mesh position={[0.2, 0.55, 0]} castShadow>
        <boxGeometry args={[1.8, 0.25, 1.1]} />
        {dark}
      </mesh>
      {/* rocker and wheels */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.55, s * 1.05]} castShadow>
          <boxGeometry args={[2.1, 0.07, 0.08]} />
          {dark}
        </mesh>
      ))}
      <group ref={wheels}>
        {WHEELS.map((p, i) => (
          <group key={i} position={[p[0], 0.4, p[1]]}>
            <group>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.4, 0.4, 0.3, 18]} />
                {dark}
              </mesh>
              {[0, 1, 2, 3].map((k) => (
                <mesh key={k} position={[Math.cos((k * Math.PI) / 2) * 0.4, Math.sin((k * Math.PI) / 2) * 0.4, 0]} rotation={[0, 0, (k * Math.PI) / 2]}>
                  <boxGeometry args={[0.12, 0.06, 0.34]} />
                  <meshStandardMaterial color="#6a6f74" roughness={0.9} />
                </mesh>
              ))}
            </group>
          </group>
        ))}
      </group>
      {/* solar panels, hinged on the deck edges */}
      <group ref={panelL} position={[0, 1.3, -0.75]}>
        <mesh position={[0, 0, -0.55]} castShadow>
          <boxGeometry args={[1.9, 0.05, 1.1]} />
          {panel}
        </mesh>
      </group>
      <group ref={panelR} position={[0, 1.3, 0.75]}>
        <mesh position={[0, 0, 0.55]} castShadow>
          <boxGeometry args={[1.9, 0.05, 1.1]} />
          {panel}
        </mesh>
      </group>
      {/* mast and camera head */}
      <mesh position={[0.6, 1.75, 0]} castShadow>
        <boxGeometry args={[0.07, 0.95, 0.07]} />
        {dark}
      </mesh>
      <group ref={head} position={[0.6, 2.25, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.32, 0.22, 0.5]} />
          {metal}
        </mesh>
        {[-0.14, 0.14].map((z) => (
          <mesh key={z} position={[0.18, 0, z]}>
            <cylinderGeometry args={[0.05, 0.05, 0.08, 10]} />
            <meshBasicMaterial color="#8ad6ff" />
          </mesh>
        ))}
      </group>
      {/* sample arm */}
      <group ref={arm} position={[1.05, 0.9, 0.45]}>
        <mesh position={[0.55, 0, 0]} castShadow>
          <boxGeometry args={[1.1, 0.1, 0.1]} />
          {dark}
        </mesh>
        <mesh position={[1.15, -0.1, 0]}>
          <cylinderGeometry args={[0.07, 0.04, 0.35, 8]} />
          <meshStandardMaterial color="#cfc8bf" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>
      {/* the relay dish */}
      <group ref={dish} position={[-0.85, 1.32, -0.3]}>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.5, 6]} />
          {dark}
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.38, 0.1, 0.1, 20]} />
          {metal}
        </mesh>
      </group>
    </group>
  );
}

const DUST_N = 90;

// ------------------------------------------------------------------ the flight

function Drive({ inputs, onHud }: { inputs: React.RefObject<RoverInputs>; onHud: (h: RoverHud) => void }) {
  const sim = useRef<Rover>(newRover());
  const st = useRef({ t: 0, hudT: 0, lastAction: 0, actionPending: false, camH: 0, spin: 0, endT: 0, dustHead: 0, dustT: 0, head: 0 });
  const keys = useRef({ w: 0, s: 0, a: 0, d: 0, up: 0, down: 0, left: 0, right: 0 });
  const { camera } = useThree();
  const root = useRef<THREE.Group>(null);
  const wheels = useRef<THREE.Group>(null);
  const panelL = useRef<THREE.Group>(null);
  const panelR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const dish = useRef<THREE.Group>(null);
  const sky = useRef<THREE.Group>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const laser = useRef<THREE.LineSegments>(null);
  const uplink = useRef<THREE.Mesh>(null);
  const dust = useRef<THREE.Points>(null);
  const beacons = useRef<BeaconState>({ next: 0, done: [false, false, false, false] });
  const puff = useMemo(() => puffTexture(), []);
  const dustPos = useMemo(() => new Float32Array(DUST_N * 3).fill(-9999), []);
  const dustLife = useRef(new Float32Array(DUST_N));
  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), goal: new THREE.Vector3(), laser: new THREE.Vector3(), shake: new THREE.Vector3() }), []);
  const laserGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    return g;
  }, []);

  useEffect(() => {
    const map: Record<string, keyof typeof keys.current> = { w: 'w', s: 's', a: 'a', d: 'd', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (!e.repeat) st.current.actionPending = true;
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
    const s = st.current;
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
    const drive = clamp(i.ly + i.ry + gl.y + gr.y + k.w - k.s + k.up - k.down);
    const steer = clamp(i.rx + i.lx + gr.x + gl.x + k.d - k.a + k.right - k.left);
    if (i.action && i.action !== s.lastAction) {
      s.lastAction = i.action;
      s.actionPending = true;
    }

    const steps = Math.max(1, Math.ceil(dt / (1 / 30)));
    for (let n = 0; n < steps; n++) {
      stepRover(d, { drive, steer, assist: i.assist ?? true, action: s.actionPending && n === 0 }, dt / steps);
    }
    s.actionPending = false;
    const over = d.phase === 'complete' || d.phase === 'failed';
    if (over) s.endT += dt;

    const rootO = root.current, wheelsO = wheels.current, panelLO = panelL.current, panelRO = panelR.current, headO = head.current, armO = arm.current, dishO = dish.current;
    const gy = terrainH(d.x, d.z);
    if (rootO && wheelsO && panelLO && panelRO && headO && armO && dishO) {
      rootO.position.set(d.x, gy, d.z);
      rootO.rotation.set(-d.roll, -d.heading, d.pitch, 'YZX');
      s.spin += (d.v / 0.4) * dt;
      for (const w of wheelsO.children) w.children[0].rotation.z = -s.spin;
      panelLO.rotation.x = (1 - d.panels) * 1.45;
      panelRO.rotation.x = -(1 - d.panels) * 1.45;
      // the mast head looks at the next stop; the arm and dish work during their activities
      const next = nextTarget(d);
      const rel = wrapPi(Math.atan2(next.target.z - d.z, next.target.x - d.x) - d.heading);
      s.head += (THREE.MathUtils.clamp(d.phase === 'stowed' ? 0 : -rel, -2.4, 2.4) - s.head) * (1 - Math.exp(-dt * 4));
      headO.rotation.y = s.head;
      const sampling = d.activity === 'sample' ? Math.sin(Math.min(1, d.actT / SAMPLE_T) * Math.PI) : 0;
      armO.rotation.z = -0.15 - sampling * 0.95;
      armO.position.y = 0.9 - sampling * 0.1;
      const dishUp = d.activity === 'uplink' || d.uplinked;
      dishO.rotation.z += (-(dishUp ? 0.5 : 1.5) - dishO.rotation.z) * (1 - Math.exp(-dt * 3));
      dishO.rotation.x += ((dishUp ? 0.25 : 0) - dishO.rotation.x) * (1 - Math.exp(-dt * 3));
      dishO.visible = d.panels > 0.55;
    }

    // a laser from the mast to the sample site while sampling
    if (laser.current) {
      const on = d.activity === 'sample' && d.actIdx >= 0 && Math.floor(s.t * 8) % 2 === 0;
      laser.current.visible = on;
      if (on) {
        const t = TARGETS[d.actIdx];
        const a = laser.current.geometry.attributes.position as THREE.BufferAttribute;
        const c = Math.cos(d.heading), sn = Math.sin(d.heading);
        a.setXYZ(0, d.x + c * 0.6, gy + 2.25, d.z + sn * 0.6);
        a.setXYZ(1, t.x, 0.1, t.z);
        a.needsUpdate = true;
      }
    }
    if (uplink.current) {
      const on = d.activity === 'uplink';
      uplink.current.visible = on;
      if (on) {
        uplink.current.position.set(d.x - Math.cos(d.heading) * 0.85 + Math.sin(d.heading) * 0.3, gy + 130, d.z - Math.sin(d.heading) * 0.85 - Math.cos(d.heading) * 0.3);
        (uplink.current.material as THREE.MeshBasicMaterial).opacity = 0.22 + 0.12 * Math.sin(s.t * 12);
      }
    }

    const nt = nextTarget(d);
    beacons.current.next = nt.index;
    beacons.current.done = [...d.samples, d.uplinked];

    // dust kicked up behind the wheels
    const pts = dust.current;
    if (pts) {
      const pa = pts.geometry.attributes.position.array as Float32Array;
      const speed = Math.abs(d.v);
      s.dustT += dt * (speed > 0.2 ? 14 * (inPit(d.x, d.z) ? 2.2 : 1) : 0);
      while (s.dustT >= 1) {
        s.dustT -= 1;
        const n = s.dustHead++ % DUST_N;
        const c = Math.cos(d.heading), sn = Math.sin(d.heading);
        pa[n * 3] = d.x - c * 1.2 + (Math.random() - 0.5) * 1.6;
        pa[n * 3 + 1] = 0.15;
        pa[n * 3 + 2] = d.z - sn * 1.2 + (Math.random() - 0.5) * 1.6;
        dustLife.current[n] = 1;
      }
      for (let n = 0; n < DUST_N; n++) {
        if (dustLife.current[n] > 0) {
          dustLife.current[n] = Math.max(0, dustLife.current[n] - dt * 0.9);
          pa[n * 3 + 1] += dt * 0.7;
          if (dustLife.current[n] === 0) pa[n * 3 + 1] = -9999;
        }
      }
      pts.geometry.attributes.position.needsUpdate = true;
    }

    // chase camera: behind and above, easing around corners; slow orbit when it is over
    let heading = d.heading;
    if (over && d.phase === 'complete') heading += s.endT * 0.35;
    s.camH += wrapPi(heading - s.camH) * (1 - Math.exp(-dt * 2.4));
    const back = d.phase === 'stowed' ? 9 : 8;
    const shake = d.bump * 0.18;
    tmp.goal.set(d.x - Math.cos(s.camH) * back, gy + 4.2, d.z - Math.sin(s.camH) * back);
    camera.position.lerp(tmp.goal, 1 - Math.exp(-dt * 4));
    camera.position.add(tmp.shake.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
    camera.position.setY(Math.max(0.8, camera.position.y));
    tmp.look.set(d.x + Math.cos(s.camH) * 6, gy - 1.3, d.z + Math.sin(s.camH) * 6);
    camera.lookAt(tmp.look);

    if (sky.current) sky.current.position.copy(camera.position);
    if (sun.current) {
      sun.current.position.set(d.x, 0, d.z).addScaledVector(SUN_DIR, 120);
      sun.current.target.position.set(d.x, 0, d.z);
      sun.current.target.updateMatrixWorld();
    }

    s.hudT += dt;
    if (s.hudT > 0.1 || (over && s.hudT > 0.02)) {
      s.hudT = 0;
      const dist = distTo(d, nt.target);
      const hz = nearestHazard(d);
      const dur = d.activity === 'unstow' ? 6 : d.activity === 'sample' ? SAMPLE_T : d.activity === 'uplink' ? UPLINK_T : 1;
      onHud({
        t: d.t,
        phase: d.phase,
        x: d.x,
        z: d.z,
        heading: d.heading,
        v: d.v,
        battery: d.battery,
        damage: d.damage,
        tilt: d.tilt,
        samples: [...d.samples],
        activity: d.activity,
        actFrac: d.activity === 'none' ? 0 : Math.min(1, d.actT / dur),
        nextName: nt.target.name,
        nextDist: dist,
        nextBearing: wrapPi(Math.atan2(nt.target.z - d.z, nt.target.x - d.x) - d.heading),
        relay: nt.relay,
        inRange: dist <= (nt.relay ? RELAY_R : SAMPLE_R),
        inPit: inPit(d.x, d.z),
        hazard: hz ? hz.kind : null,
        sink: d.sink,
        distance: d.distance,
        uplinked: d.uplinked,
        result: d.result,
      });
    }
  });

  return (
    <>
      <fogExp2 attach="fog" args={['#d9a07a', 0.0007]} />
      <ambientLight intensity={0.35} color="#ffd9bc" />
      <hemisphereLight args={['#f1c6a0', '#3a1f14', 0.35]} />
      <directionalLight
        ref={sun}
        color="#ffe6cc"
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
        shadow-camera-near={10}
        shadow-camera-far={300}
        shadow-bias={-0.0006}
      />
      <Sky group={sky} />
      <group renderOrder={-2}>
        <Ground />
      </group>
      <LandingScar />
      <Pits />
      <Craters />
      <Rocks />
      {TARGETS.map((t, n) => (
        <Beacon key={t.name} x={t.x} z={t.z} radius={SAMPLE_R} index={n} state={beacons} />
      ))}
      <Beacon x={RELAY.x} z={RELAY.z} radius={RELAY_R} index={3} state={beacons} />
      <Wren root={root} wheels={wheels} panelL={panelL} panelR={panelR} head={head} arm={arm} dish={dish} />
      <lineSegments ref={laser} geometry={laserGeo} visible={false} frustumCulled={false}>
        <lineBasicMaterial color="#ff5a5a" />
      </lineSegments>
      <mesh ref={uplink} visible={false} frustumCulled={false}>
        <cylinderGeometry args={[0.12, 0.35, 260, 8, 1, true]} />
        <meshBasicMaterial color="#5ee9d4" transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <points ref={dust} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustPos, 3]} />
        </bufferGeometry>
        <pointsMaterial map={puff} size={2.2} color="#c9926a" transparent opacity={0.45} depthWrite={false} sizeAttenuation />
      </points>
    </>
  );
}

export default function RoverScene({ inputs, onHud }: { inputs: React.RefObject<RoverInputs>; onHud: (h: RoverHud) => void }) {
  return (
    <Canvas camera={{ position: [-9, 4, 0], fov: 58, near: 0.2, far: 60000 }} dpr={[1, 2]} shadows gl={{ logarithmicDepthBuffer: true }}>
      <Drive inputs={inputs} onHud={onHud} />
    </Canvas>
  );
}
