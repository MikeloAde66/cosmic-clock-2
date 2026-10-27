'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// The Astro Simulator's hub card: a small live view from inside a spacecraft,
// built in code. The Earth uses the repo's NASA Blue Marble texture; the stars,
// the cockpit frame and the instrument screens are generated here. It is a
// decorative preview, not a live view of anything.

const EARTH_TEXTURE = '/earth/blue-marble.jpg';
const SUN_DIR = new THREE.Vector3(-0.8, 0.3, 0.3).normalize();
const FRAME_Z = -1;
const FACE_Z = FRAME_Z + 0.02; // in front of the frame's bevelled face
const SCREEN_FPS = 12;
const RENDER_FPS = 30;

type Pt = [number, number];

function polygon(points: Pt[]): THREE.Path {
  const p = new THREE.Path();
  points.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
  p.closePath();
  return p;
}

// The canopy frame: one metal slab with the windows cut out of it.
function buildFrame(): THREE.Mesh {
  const outer = new THREE.Shape();
  outer.moveTo(-1.6, -0.8);
  outer.lineTo(1.6, -0.8);
  outer.lineTo(1.6, 0.8);
  outer.lineTo(-1.6, 0.8);
  outer.closePath();
  outer.holes.push(
    polygon([[-0.95, 0.45], [-0.04, 0.46], [-0.04, -0.03], [-1.02, -0.06]]),
    polygon([[0.04, 0.46], [0.95, 0.45], [1.02, -0.06], [0.04, -0.03]]),
    polygon([[-1.6, 0.4], [-1.13, 0.42], [-1.16, -0.02], [-1.6, 0.0]]),
    polygon([[1.13, 0.42], [1.6, 0.4], [1.6, 0.0], [1.16, -0.02]]),
  );
  const geo = new THREE.ExtrudeGeometry(outer, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a2025, metalness: 0.75, roughness: 0.42 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = FRAME_Z - 0.05;
  return mesh;
}

// Rows of tiny lit switches and indicators on the overhead panel and consoles.
function buildLights(): THREE.Points {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const palette = [0xffb347, 0xffb347, 0xffd08a, 0x5ee9d4, 0x7dd3a0, 0xff6a5a];
  const put = (x: number, y: number, hex: number, k = 1) => {
    pos.push(x, y, FACE_Z + 0.004);
    c.setHex(hex).multiplyScalar(k);
    col.push(c.r, c.g, c.b);
  };
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 70; i++) {
      if (rnd() < 0.38) continue;
      put(-1.05 + (i / 69) * 2.1 + (rnd() - 0.5) * 0.004, 0.478 + row * 0.014, palette[Math.floor(rnd() * palette.length)], 0.5 + rnd() * 0.7);
    }
  }
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 40; i++) {
      if (rnd() < 0.45) continue;
      put(-1.1 + (i / 39) * 0.5, -0.42 - row * 0.04, palette[Math.floor(rnd() * palette.length)], 0.5 + rnd() * 0.7);
      put(0.6 + (i / 39) * 0.5, -0.42 - row * 0.04, palette[Math.floor(rnd() * palette.length)], 0.5 + rnd() * 0.7);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, toneMapped: false }));
}

type Draw = (g: CanvasRenderingContext2D, w: number, h: number, t: number, earth: CanvasImageSource | null) => void;

const radar: Draw = (g, w, h, t) => {
  g.fillStyle = '#031210';
  g.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const r = h * 0.44;
  g.strokeStyle = 'rgba(94,233,212,.55)';
  g.lineWidth = 2;
  for (const k of [1, 0.66, 0.33]) {
    g.beginPath();
    g.arc(cx, cy, r * k, 0, Math.PI * 2);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(cx - r, cy);
  g.lineTo(cx + r, cy);
  g.moveTo(cx, cy - r);
  g.lineTo(cx, cy + r);
  g.stroke();
  const a = t * 1.6;
  const grad = g.createConicGradient(a - 0.9, cx, cy);
  grad.addColorStop(0, 'rgba(94,233,212,0)');
  grad.addColorStop(0.14, 'rgba(94,233,212,.7)');
  grad.addColorStop(0.145, 'rgba(94,233,212,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffd08a';
  for (const [bx, by] of [[0.3, -0.5], [-0.55, 0.2], [0.1, 0.6]]) g.fillRect(cx + bx * r - 3, cy + by * r - 3, 6, 6);
};

const telemetry: Draw = (g, w, h, t) => {
  g.fillStyle = '#120b02';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) {
    const y = 14 + i * (h - 24) / 7;
    const len = (0.25 + 0.7 * Math.abs(Math.sin(t * (0.4 + i * 0.13) + i * 1.7))) * (w - 40);
    g.fillStyle = 'rgba(255,179,71,.25)';
    g.fillRect(14, y, w - 28, 8);
    g.fillStyle = i % 3 === 0 ? '#ffd08a' : '#ffb347';
    g.fillRect(14, y, len, 8);
  }
};

const waves: Draw = (g, w, h, t) => {
  g.fillStyle = '#021208';
  g.fillRect(0, 0, w, h);
  g.lineWidth = 2;
  [['#7dd3a0', 0.9, 0.05], ['#5ee9d4', 0.5, 0.11]].forEach(([c, amp, f], n) => {
    g.strokeStyle = c as string;
    g.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const y = h / 2 + Math.sin(x * (f as number) + t * (2 + n)) * (h * 0.28) * (amp as number) * (0.6 + 0.4 * Math.sin(x * 0.02 + t));
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  });
};

const starmap: Draw = (g, w, h, t) => {
  g.fillStyle = '#030814';
  g.fillRect(0, 0, w, h);
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#cfe6ff';
  for (let i = 0; i < 60; i++) g.fillRect(rnd() * w, rnd() * h, 2, 2);
  g.strokeStyle = 'rgba(95,240,255,.6)';
  g.lineWidth = 2;
  const x = w * 0.5 + Math.sin(t * 0.5) * w * 0.2;
  const y = h * 0.5 + Math.cos(t * 0.4) * h * 0.2;
  g.beginPath();
  g.arc(x, y, 14, 0, Math.PI * 2);
  g.moveTo(x - 24, y);
  g.lineTo(x - 8, y);
  g.moveTo(x + 8, y);
  g.lineTo(x + 24, y);
  g.stroke();
};

const groundMap: Draw = (g, w, h, t, earth) => {
  g.fillStyle = '#020a14';
  g.fillRect(0, 0, w, h);
  if (earth) {
    g.globalAlpha = 0.85;
    g.drawImage(earth, 0, 0, w, h);
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(2,20,40,.35)';
    g.fillRect(0, 0, w, h);
  }
  g.strokeStyle = 'rgba(94,233,212,.35)';
  g.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    g.beginPath();
    g.moveTo((i * w) / 6, 0);
    g.lineTo((i * w) / 6, h);
    g.moveTo(0, (i * h) / 6);
    g.lineTo(w, (i * h) / 6);
    g.stroke();
  }
  g.strokeStyle = '#ffb347';
  g.lineWidth = 2;
  g.beginPath();
  for (let x = 0; x <= w; x += 4) {
    const y = h / 2 + Math.sin((x / w) * Math.PI * 2 - 0.6) * h * 0.34;
    if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
  }
  g.stroke();
  const px = ((t * 14) % w);
  g.fillStyle = '#ffd08a';
  g.beginPath();
  g.arc(px, h / 2 + Math.sin((px / w) * Math.PI * 2 - 0.6) * h * 0.34, 4, 0, Math.PI * 2);
  g.fill();
};

interface Screen {
  mesh: THREE.Mesh;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  draw: Draw;
  w: number;
  h: number;
}

function buildScreens(group: THREE.Group): Screen[] {
  const layout: { x: number; y: number; w: number; h: number; draw: Draw }[] = [
    { x: -0.8, y: -0.2, w: 0.25, h: 0.14, draw: radar },
    { x: -0.52, y: -0.2, w: 0.25, h: 0.14, draw: telemetry },
    { x: -0.24, y: -0.2, w: 0.25, h: 0.14, draw: waves },
    { x: 0.24, y: -0.2, w: 0.25, h: 0.14, draw: starmap },
    { x: 0.52, y: -0.2, w: 0.25, h: 0.14, draw: telemetry },
    { x: 0.8, y: -0.2, w: 0.25, h: 0.14, draw: radar },
    { x: 0, y: -0.3, w: 0.34, h: 0.19, draw: groundMap },
  ];
  const bezel = new THREE.MeshStandardMaterial({ color: 0x070a0d, metalness: 0.6, roughness: 0.5 });
  return layout.map((l) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = Math.round(256 * (l.h / l.w));
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(l.w, l.h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    mesh.position.set(l.x, l.y, FACE_Z + 0.003);
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(l.w + 0.022, l.h + 0.022), bezel);
    frame.position.set(l.x, l.y, FACE_Z + 0.001);
    group.add(frame, mesh);
    return { mesh, ctx: canvas.getContext('2d')!, tex, draw: l.draw, w: canvas.width, h: canvas.height };
  });
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,250,235,1)');
  grad.addColorStop(0.12, 'rgba(255,236,190,.65)');
  grad.addColorStop(0.4, 'rgba(255,200,120,.16)');
  grad.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function CockpitCard() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    } catch {
      return; // no WebGL: the dark card background stays
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.setClearColor(0x01030a);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 2, 0.05, 300);
    scene.add(camera);

    // Earth, with its limb curving across the windows.
    const disposables: { dispose(): void }[] = [renderer];
    const earthTex = new THREE.TextureLoader().load(EARTH_TEXTURE);
    earthTex.colorSpace = THREE.SRGBColorSpace;
    earthTex.anisotropy = 4;
    disposables.push(earthTex);
    const EARTH_R = 30;
    const earthPivot = new THREE.Group();
    earthPivot.position.set(0, -EARTH_R + 5, -34);
    earthPivot.rotation.z = THREE.MathUtils.degToRad(-12);
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R, 128, 64),
      new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.92, metalness: 0, emissive: 0x0b1c36, emissiveIntensity: 0.7 }),
    );
    earthPivot.add(earth);
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R * 1.028, 96, 48),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { sun: { value: SUN_DIR.clone() } },
        vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.0); }',
        fragmentShader:
          'uniform vec3 sun; varying vec3 vN; varying vec3 vW; void main(){ vec3 v = normalize(cameraPosition - vW); float rim = pow(clamp(dot(-vN, v) * 1.0 + 0.02, 0.0, 1.0), 3.2); float lit = clamp(dot(normalize(vW - vec3(0.0,-25.0,-34.0)), sun) * 0.9 + 0.55, 0.15, 1.0); gl_FragColor = vec4(vec3(0.26,0.52,1.0) * rim * lit * 1.9, rim * lit); }',
      }),
    );
    earthPivot.add(atmo);
    scene.add(earthPivot);
    disposables.push(earth.geometry, atmo.geometry, earth.material as THREE.Material, atmo.material as THREE.Material);

    // Stars.
    const starPos: number[] = [];
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) {
      const u = rnd() * 2 - 1;
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      starPos.push(Math.cos(a) * r * 150, u * 150, Math.sin(a) * r * 150);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xdfe9ff, size: 1.0, sizeAttenuation: false, transparent: true, opacity: 0.7 });
    scene.add(new THREE.Points(starGeo, starMat));
    disposables.push(starGeo, starMat);

    // Sun flare sitting on the lit limb.
    const flareTex = glowTexture();
    const flareMat = new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0.6 });
    const flare = new THREE.Sprite(flareMat);
    flare.position.copy(new THREE.Vector3(-0.95, 0.05, -1.2).normalize().multiplyScalar(120));
    flare.scale.setScalar(20);
    flare.renderOrder = 5;
    scene.add(flare);
    disposables.push(flareTex, flareMat);

    // Light: the sun, plus a cool bounce off the Earth for the underside of the frame.
    const sun = new THREE.DirectionalLight(0xfff0d8, 3.2);
    sun.position.copy(SUN_DIR).multiplyScalar(10);
    scene.add(sun);
    const bounce = new THREE.HemisphereLight(0x0a1220, 0x2d5a98, 0.9);
    scene.add(bounce);
    scene.add(new THREE.AmbientLight(0x1a2233, 0.35));

    // The cockpit, riding on the camera so the view moves behind it.
    const cockpit = new THREE.Group();
    const frame = buildFrame();
    cockpit.add(frame);
    const lights = buildLights();
    cockpit.add(lights);
    const screens = buildScreens(cockpit);
    camera.add(cockpit);
    disposables.push(frame.geometry, frame.material as THREE.Material, lights.geometry, lights.material as THREE.Material);
    screens.forEach((s) => disposables.push(s.tex, s.mesh.geometry, s.mesh.material as THREE.Material));

    const size = () => {
      const w = el.clientWidth || 208;
      const h = el.clientHeight || 96;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let visible = true;
    let last = 0;
    let lastScreens = -1;
    const t0 = performance.now();

    const frameAt = (now: number) => {
      const t = (now - t0) / 1000;
      earth.rotation.y = -0.4 + t * 0.012;
      camera.rotation.set(THREE.MathUtils.degToRad(-6.5) + Math.sin(t * 0.21) * 0.006, Math.sin(t * 0.13) * 0.014, Math.sin(t * 0.17) * 0.008);
      flareMat.opacity = 0.55 + Math.sin(t * 0.9) * 0.06;
      if (t - lastScreens > 1 / SCREEN_FPS) {
        lastScreens = t;
        const img = earthTex.image as CanvasImageSource | undefined;
        for (const s of screens) {
          s.draw(s.ctx, s.w, s.h, t, img ?? null);
          s.tex.needsUpdate = true;
        }
      }
      renderer.render(scene, camera);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden || now - last < 1000 / RENDER_FPS) return;
      last = now;
      frameAt(now);
    };

    let io: IntersectionObserver | null = null;
    if (reduce) {
      // one still frame, redrawn once the texture arrives
      earthTex.onUpdate = () => frameAt(performance.now());
      frameAt(performance.now());
    } else {
      io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
      io.observe(el);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      ro.disconnect();
      disposables.forEach((d) => d.dispose());
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="relative w-[calc(100%+2.5rem)] h-24 mb-3 -mx-5 -mt-5 overflow-hidden shrink-0 bg-[#01030a]">
      <div ref={host} className="absolute inset-0" />
      {/* faint glass: edge falloff and one soft diagonal reflection */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 55%, transparent 55%, rgba(0,0,0,0.45) 100%), linear-gradient(115deg, transparent 38%, rgba(190,215,255,0.05) 46%, transparent 54%)',
        }}
      />
    </div>
  );
}
