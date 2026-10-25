import * as THREE from 'three';
import { latLonToUV } from '@/lib/astroSim/coords';
import { LUNAR_TARGETS } from '@/lib/astroSim/lunar';
import { MOON_RADIUS_KM } from '@/lib/astroSim/coords';

// Real surface imagery is not bundled (the build environment could not reach
// NASA). Drop an equirectangular Moon map (lon -180..180, centre = lon 0,
// e.g. NASA SVS "CGI Moon Kit" / LROC WAC mosaic) at public/textures/moon.jpg
// and the view upgrades from SIM to ENHANCED automatically.
export const MOON_TEXTURE_URL = '/textures/moon.jpg';

export async function loadRealMoonTexture(): Promise<THREE.Texture | null> {
  try {
    const head = await fetch(MOON_TEXTURE_URL, { method: 'HEAD' });
    if (!head.ok || !(head.headers.get('content-type') ?? '').startsWith('image/')) return null;
    const tex = await new THREE.TextureLoader().loadAsync(MOON_TEXTURE_URL);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  } catch {
    return null;
  }
}

// Small deterministic PRNG so the fallback looks the same on every load.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Procedural stand-in for the lunar surface: speckled regolith, dark maria
 * and ringed craters placed from the (unverified) target table. This is a
 * SIMULATION of what the Moon looks like, not imagery of it.
 */
export function makeProceduralMoonTexture(): THREE.CanvasTexture {
  const W = 2048;
  const H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  const rand = mulberry32(1969);

  g.fillStyle = '#8a8884';
  g.fillRect(0, 0, W, H);
  // Regolith mottling.
  for (let i = 0; i < 26000; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 1 + rand() * 14;
    const v = 110 + rand() * 70;
    g.fillStyle = `rgba(${v},${v - 2},${v - 6},${0.05 + rand() * 0.08})`;
    g.beginPath();
    g.arc(x, y, r, 0, 7);
    g.fill();
  }
  // Small random craters.
  for (let i = 0; i < 2500; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 1.5 + rand() ** 3 * 18;
    g.strokeStyle = `rgba(230,228,222,${0.15 + rand() * 0.2})`;
    g.lineWidth = Math.max(0.8, r * 0.12);
    g.beginPath();
    g.arc(x, y, r, 0, 7);
    g.stroke();
    g.fillStyle = 'rgba(40,40,42,0.12)';
    g.beginPath();
    g.arc(x + r * 0.15, y + r * 0.15, r * 0.85, 0, 7);
    g.fill();
  }
  // Maria and named craters from the target table. Equirectangular, so a
  // feature's pixel width shrinks toward the poles by cos(lat) in x.
  const kmToPx = H / (Math.PI * MOON_RADIUS_KM);
  for (const t of LUNAR_TARGETS) {
    if (t.diameterKm == null) continue;
    const { u, v } = latLonToUV(t.latDeg, t.lonDeg);
    const x = u * W;
    const y = (1 - v) * H;
    const ry = (t.diameterKm / 2) * kmToPx;
    const rx = ry / Math.max(0.15, Math.cos((t.latDeg * Math.PI) / 180));
    if (t.type === 'mare') {
      g.fillStyle = 'rgba(45,47,52,0.55)';
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, 7);
      g.fill();
    } else if (t.type === 'crater') {
      g.fillStyle = 'rgba(30,30,34,0.35)';
      g.beginPath();
      g.ellipse(x, y, rx * 0.9, ry * 0.9, 0, 0, 7);
      g.fill();
      g.strokeStyle = 'rgba(240,238,230,0.55)';
      g.lineWidth = Math.max(1, ry * 0.12);
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, 7);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
