// Bridge between the Flight Academy trainer (a Next.js page) and the
// Spectre-AI GCS simulator, which is a prebuilt single-file bundle served
// from public/spectre-gcs.html and embedded here in a same-origin iframe.
//
// The bundle exposes its live store as `window.__GCS__`. That is the only
// integration surface: we read vehicle state from it every tick, and drive
// the sim the same way a pilot would — by clicking its own buttons (so its
// React UI re-renders and logs the action) — rather than reaching into
// internal action functions the bundle never exported.

export interface StickInput {
  pitch: number;
  roll: number;
  yaw: number;
  thr: number;
}

export interface GcsLog {
  id: number;
  type: string;
  text: string;
}

export interface GcsDetection {
  id: number;
  label: string;
  conf: number;
}

// Plain snapshot of everything a lesson objective is allowed to look at.
// Units follow the sim: metres, m/s, degrees; e/n are east/north of home.
export interface Snap {
  e: number;
  n: number;
  alt: number;
  ve: number;
  vn: number;
  vz: number;
  gs: number;
  yaw: number;
  pitch: number;
  roll: number;
  armed: boolean;
  landed: boolean;
  crashed: boolean;
  mode: string;
  soc: number;
  distHome: number;
  input: StickInput;
  gpsLoss: boolean;
  linkLoss: boolean;
  gusts: boolean;
  windSpd: number;
  thermal: boolean;
  target: number | null;
  targetType: string | null;
  detections: GcsDetection[];
  gimbalPitch: number;
  waypointCount: number;
  wpIndex: number;
  logs: GcsLog[];
  /** True when the home pad (0,0,0) projects inside the Sim Cam frame. */
  padInFrame: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type GcsStore = any;

// HUD regions the instructor can light up inside the simulator.
export type HudKey =
  | 'horizon'
  | 'altTape'
  | 'spdTape'
  | 'heading'
  | 'vsi'
  | 'distHome'
  | 'map'
  | 'cam'
  | 'mavlink'
  | 'deck'
  | 'failures'
  | 'analytics'
  | 'mode'
  | 'status';

// Buttons/controls in the simulator a lesson can point the student at.
export type ControlKey =
  | 'takeoff'
  | 'mode'
  | 'thermal'
  | 'lock'
  | 'gimbal'
  | 'addWp'
  | 'exec'
  | 'rtl'
  | 'land';

const CONTROL_SELECTORS: Record<ControlKey, string> = {
  takeoff: '#takeoff-btn',
  mode: '#mode-select',
  thermal: '#thermal-btn',
  lock: '#lock-btn',
  gimbal: '#gimbal-pitch',
  addWp: '#add-wp',
  exec: '#exec-btn',
  rtl: '#rtl-btn',
  land: '#land-btn',
};

const HL_STYLE = `
[data-fa-hl]{outline:2px solid #22d3ee!important;outline-offset:2px;box-shadow:0 0 0 4px rgba(34,211,238,.16),0 0 28px rgba(34,211,238,.45)!important;transition:box-shadow .25s,outline-color .25s;border-radius:10px}
[data-fa-point]{outline:2px solid #fbbf24!important;outline-offset:3px;animation:fa-pulse 1.1s ease-in-out infinite}
@keyframes fa-pulse{0%,100%{box-shadow:0 0 0 0 rgba(251,191,36,.55)}50%{box-shadow:0 0 0 8px rgba(251,191,36,0)}}
@media (prefers-reduced-motion:reduce){[data-fa-point]{animation:none}}
`;

function wrap180(d: number) {
  return ((((d + 180) % 360) + 360) % 360) - 180;
}

export function angleDiff(a: number, b: number) {
  return wrap180(a - b);
}

export class GcsBridge {
  private frame: HTMLIFrameElement;

  constructor(frame: HTMLIFrameElement) {
    this.frame = frame;
  }

  get store(): GcsStore | null {
    try {
      return (this.frame.contentWindow as any)?.__GCS__ ?? null;
    } catch {
      return null;
    }
  }

  get doc(): Document | null {
    try {
      return this.frame.contentDocument;
    } catch {
      return null;
    }
  }

  ready() {
    const s = this.store;
    return !!(s && s.v && s.faults && this.doc?.getElementById('takeoff-btn'));
  }

  snapshot(): Snap | null {
    const g = this.store;
    if (!g || !g.v || !g.faults) return null;
    const v = g.v;
    const f = g.faults;
    const targetEntity = g.target != null ? (g.entities || []).find((x: any) => x.id === g.target) : null;
    let padInFrame = false;
    try {
      const cam = g.cam;
      if (cam) {
        const c = cam.toCam([0, 0, 0]);
        if (c[2] > 0.5) {
          const [x, y] = cam.proj(c);
          padInFrame = x > 0 && x < cam.W && y > 0 && y < cam.H;
        }
      }
    } catch {
      padInFrame = false;
    }
    return {
      e: v.e,
      n: v.n,
      alt: v.alt,
      ve: v.ve,
      vn: v.vn,
      vz: v.vz,
      gs: Math.hypot(v.ve, v.vn),
      yaw: v.yaw,
      pitch: v.pitch,
      roll: v.roll,
      armed: !!v.armed,
      landed: !!v.landed,
      crashed: !!v.crashed,
      mode: String(v.mode),
      soc: v.soc,
      distHome: Math.hypot(v.e, v.n),
      input: { ...(g.input || { pitch: 0, roll: 0, yaw: 0, thr: 0 }) },
      gpsLoss: !!f.gpsLoss,
      linkLoss: !!f.linkLoss,
      gusts: !!f.gusts,
      windSpd: f.windSpd || 0,
      thermal: !!g.thermal,
      target: g.target ?? null,
      targetType: targetEntity ? targetEntity.type : null,
      detections: (g.detections || []).map((d: any) => ({ id: d.id, label: d.label, conf: d.conf })),
      gimbalPitch: g.gimbal?.pitch ?? 0,
      waypointCount: (g.waypoints || []).length,
      wpIndex: v.wpIndex || 0,
      logs: g.logs || [],
      padInFrame,
    };
  }

  private click(sel: string) {
    const el = this.doc?.querySelector<HTMLElement>(sel);
    el?.click();
    return !!el;
  }

  resetOnPad() {
    this.click('#reset-pad');
  }

  resetAirborne() {
    this.click('#reset-air');
  }

  // The fault buttons toggle; only click when the state actually differs.
  setFault(key: 'gpsLoss' | 'linkLoss' | 'gusts', on: boolean) {
    const g = this.store;
    if (!g?.faults) return;
    if (!!g.faults[key] !== on) this.click(`#fault-${key}`);
  }

  setWind(speed: number, fromDeg = 270) {
    const g = this.store;
    if (!g?.faults) return;
    g.faults.windSpd = speed;
    g.faults.windDir = fromDeg;
  }

  batterySag(times = 1) {
    for (let i = 0; i < times; i++) this.click('#fault-batt');
  }

  // Pretest and lessons always run at real time.
  normalSpeed() {
    const g = this.store;
    if (g) g.speed = 1;
  }

  focusSim() {
    try {
      this.frame.contentWindow?.focus();
    } catch {
      /* cross-origin never happens here, but stay quiet if it does */
    }
  }

  private ensureStyle() {
    const doc = this.doc;
    if (!doc || doc.getElementById('fa-style')) return;
    const st = doc.createElement('style');
    st.id = 'fa-style';
    st.textContent = HL_STYLE;
    doc.head.appendChild(st);
  }

  private sectionByHeading(text: string): HTMLElement | null {
    const doc = this.doc;
    if (!doc) return null;
    const spans = doc.querySelectorAll('section span');
    for (const s of Array.from(spans)) {
      if ((s.textContent || '').trim().toUpperCase().startsWith(text)) return s.closest('section');
    }
    return null;
  }

  private labelBox(label: string): HTMLElement | null {
    const doc = this.doc;
    if (!doc) return null;
    const all = doc.querySelectorAll('div,span');
    for (const el of Array.from(all)) {
      if (el.childElementCount === 0 && (el.textContent || '').trim().toUpperCase() === label) {
        return el.parentElement;
      }
    }
    return null;
  }

  hudElement(key: HudKey): HTMLElement | null {
    const doc = this.doc;
    if (!doc) return null;
    switch (key) {
      case 'horizon':
        return this.sectionByHeading('ARTIFICIAL HORIZON');
      case 'altTape':
        return doc.getElementById('alt')?.parentElement ?? null;
      case 'spdTape':
        return doc.getElementById('spd')?.parentElement ?? null;
      case 'heading':
        return this.labelBox('HEADING');
      case 'vsi':
        return this.labelBox('VSI');
      case 'distHome':
        return this.labelBox('DIST HOME');
      case 'map':
        return doc.getElementById('map')?.closest('section') ?? this.sectionByHeading('MISSION MAP');
      case 'cam':
        return (doc.getElementById('cam')?.parentElement as HTMLElement | null) ?? null;
      case 'mavlink':
        return doc.getElementById('terminal')?.closest('section') ?? this.sectionByHeading('MAVLINK');
      case 'deck':
        return this.sectionByHeading('MANUAL PILOT DECK');
      case 'failures':
        return this.sectionByHeading('FAILURE INJECTION');
      case 'analytics':
        return this.sectionByHeading('AI ANALYTICS');
      case 'mode':
        return doc.getElementById('mode-select');
      case 'status':
        return doc.querySelector('header') as HTMLElement | null;
    }
  }

  /** Light up exactly this set of HUD regions (others are cleared). */
  highlight(keys: HudKey[]) {
    const doc = this.doc;
    if (!doc) return;
    this.ensureStyle();
    const want = new Set<HTMLElement>();
    for (const k of keys) {
      const el = this.hudElement(k);
      if (el) want.add(el);
    }
    doc.querySelectorAll<HTMLElement>('[data-fa-hl]').forEach((el) => {
      if (!want.has(el)) el.removeAttribute('data-fa-hl');
    });
    want.forEach((el) => el.setAttribute('data-fa-hl', ''));
  }

  /** Pulse the control the student should use next (or clear with null). */
  point(key: ControlKey | null) {
    const doc = this.doc;
    if (!doc) return;
    this.ensureStyle();
    const target = key ? doc.querySelector<HTMLElement>(CONTROL_SELECTORS[key]) : null;
    doc.querySelectorAll<HTMLElement>('[data-fa-point]').forEach((el) => {
      if (el !== target) el.removeAttribute('data-fa-point');
    });
    if (target && !target.hasAttribute('data-fa-point')) {
      target.setAttribute('data-fa-point', '');
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  clearAll() {
    this.highlight([]);
    this.point(null);
  }
}
