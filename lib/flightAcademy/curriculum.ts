import { angleDiff, type ControlKey, type GcsBridge, type HudKey, type Snap } from './gcs';

// The Flight Academy syllabus. Every lesson runs inside the real Spectre-AI
// GCS simulator; objectives are checked live against its state, so a lesson
// is passed by flying it, not by ticking a box.
//
// Structure (stage → module → lesson) mirrors how real pilots are trained:
// feel the aircraft first (evaluation), learn why it moves (aero), learn to
// read and trust the cockpit when things fail, then fly real jobs.

export type ModuleId = 'eval' | 'm1' | 'm2' | 'm3';

// Per-run scratch memory objectives share with each other.
export interface Mem {
  logMark?: number;
  ringE?: number;
  ringN?: number;
  ringR?: number;
  altRef?: number;
  yaw0?: number;
  lastYaw?: number;
  yawAcc?: number;
  lastAng?: number;
  orbitAcc?: number;
  startE?: number;
  startN?: number;
  locked?: number[];
  sawRtl?: boolean;
  touchdown?: number;
  note?: string;
  hoverDevSum?: number;
  hoverAltSum?: number;
  hoverN?: number;
}

export interface Objective {
  text: string;
  /** One line of coaching shown under the active objective. */
  tip?: string;
  /** Seconds the condition must hold. Without it, `check` passing once completes the step. */
  hold?: number;
  /** Hold time accumulates instead of resetting when the condition breaks. */
  cumulative?: boolean;
  check: (s: Snap, m: Mem) => boolean;
  /** 0..1 for objectives whose progress is not a hold timer. */
  progress?: (s: Snap, m: Mem) => number;
  onStart?: (s: Snap, m: Mem, gcs: GcsBridge) => void;
  onTick?: (s: Snap, m: Mem, dt: number) => void;
  onDone?: (s: Snap, m: Mem, gcs: GcsBridge) => void;
  watch?: HudKey[];
  point?: ControlKey;
}

export interface Lesson {
  id: string;
  module: ModuleId;
  code: string;
  title: string;
  skill: string;
  minutes: number;
  /** Target time in seconds for three stars. */
  par: number;
  start: 'pad' | 'air';
  wind?: number;
  windFrom?: number;
  gusts?: boolean;
  checkride?: boolean;
  brief: {
    why: string[];
    watch: string[];
    chairFly: string;
    realWorld: string;
  };
  objectives: Objective[];
  takeaway: string;
}

export interface ModuleInfo {
  id: ModuleId;
  label: string;
  title: string;
  summary: string;
  mental: string;
  physical: string;
}

export const MODULES: ModuleInfo[] = [
  {
    id: 'eval',
    label: 'Stage 0',
    title: 'Flight Evaluation',
    summary: 'Fly before you read. Take off, hover in the wind, pitch, bank and yaw. We measure your natural stick feel and set your starting point.',
    mental: 'No theory yet. Notice what the aircraft does.',
    physical: 'First contact with both sticks.',
  },
  {
    id: 'm1',
    label: 'Module 1',
    title: 'Aerodynamic Physical Flight',
    summary: 'Connect what you felt on the sticks to lift, thrust and torque. Altitude steps, pirouettes, a box pattern with no autopilot, and a precision landing.',
    mental: 'Why four propellers can climb, tilt and turn.',
    physical: 'Small, early corrections. Smooth hands.',
  },
  {
    id: 'm2',
    label: 'Module 2',
    title: 'Cockpit & Failsafe Mastery',
    summary: 'Read the HUD like a pilot, then lose things on purpose: gusts, GPS, the radio link, battery. Learn what the autopilot does and when to take over.',
    mental: 'Instrument scan. Know every failsafe before you need it.',
    physical: 'Manual recovery when automation drops out.',
  },
  {
    id: 'm3',
    label: 'Module 3',
    title: 'Real-World Missions',
    summary: 'The reason people fly: cinematic aerial photography, thermal search and rescue with AI detection, and autonomous waypoint mapping.',
    mental: 'Plan the job, then fly the plan.',
    physical: 'Camera, gimbal and stick work at the same time.',
  },
];

/* ---------- small helpers shared by objectives ---------- */

function markLogs(s: Snap, m: Mem) {
  m.logMark = s.logs.length ? s.logs[s.logs.length - 1].id : 0;
}

function newLogs(s: Snap, m: Mem) {
  const mark = m.logMark ?? 0;
  return s.logs.filter((l) => l.id > mark);
}

function setRing(s: Snap, m: Mem, r: number) {
  m.ringE = s.e;
  m.ringN = s.n;
  m.ringR = r;
  m.altRef = s.alt;
}

function ringDist(s: Snap, m: Mem) {
  return Math.hypot(s.e - (m.ringE ?? 0), s.n - (m.ringN ?? 0));
}

function inRing(s: Snap, m: Mem) {
  return ringDist(s, m) <= (m.ringR ?? 5);
}

function hdgNear(s: Snap, target: number, tol: number) {
  return Math.abs(angleDiff(s.yaw, target)) <= tol;
}

function handsOff(s: Snap) {
  const i = s.input;
  return Math.abs(i.pitch) < 0.05 && Math.abs(i.roll) < 0.05 && Math.abs(i.yaw) < 0.05 && Math.abs(i.thr) < 0.05;
}

function startPoint(s: Snap, m: Mem) {
  m.startE = s.e;
  m.startN = s.n;
}

function fromStart(s: Snap, m: Mem) {
  return Math.hypot(s.e - (m.startE ?? 0), s.n - (m.startN ?? 0));
}

function lastTouchdown(s: Snap, m: Mem): number | null {
  const logs = newLogs(s, m);
  for (let i = logs.length - 1; i >= 0; i--) {
    const hit = /^Touchdown \(([\d.]+) m\/s\)/.exec(logs[i].text);
    if (hit) return parseFloat(hit[1]);
  }
  return null;
}

const altHold = (target: number, tol: number): Objective['check'] => (s) => Math.abs(s.alt - target) <= tol;

/* ---------- the syllabus ---------- */

export const LESSONS: Lesson[] = [
  {
    id: 'evaluation',
    module: 'eval',
    code: '0.1',
    title: 'Flight Evaluation',
    skill: 'Natural stick feel',
    minutes: 4,
    par: 90,
    start: 'pad',
    wind: 4,
    windFrom: 270,
    brief: {
      why: [
        'You learn to fly with your hands first. This short flight shows us how you react before any theory gets in the way.',
        'There is no failing here. A rough first try is useful data, and it tells us where to spend your training time.',
      ],
      watch: [
        'Artificial Horizon: it tilts when the drone tilts.',
        'SPD and ALT tapes on either side of it.',
        'The Manual Pilot Deck. Left stick is yaw and throttle, right stick is roll and pitch (W/S/A/D and the arrow keys work too).',
      ],
      chairFly: 'Before you start, put your hands where the sticks would be. Push the right stick forward and say "nose down, speed up." Pull it back: "nose up, slow down." Tilt it right: "bank right, slide right."',
      realWorld: 'This is the same order an instructor uses on a real field: hover first, then one axis at a time.',
    },
    objectives: [
      {
        text: 'Press ARM + TAKEOFF 15 m',
        tip: 'The autopilot arms the motors and climbs straight up for you.',
        point: 'takeoff',
        watch: ['altTape', 'vsi'],
        check: (s) => s.armed && s.alt >= 13.5,
      },
      {
        text: 'Set MODE to STABILIZE (MANUAL)',
        tip: 'In STABILIZE nothing holds your position. A 4 m/s wind is blowing from the west.',
        point: 'mode',
        watch: ['mode'],
        check: (s) => s.mode === 'STABILIZE',
      },
      {
        text: 'Hover: stay within 6 m of this spot for 10 s',
        tip: 'Hold a little right stick into the wind. Small, early corrections beat big late ones.',
        hold: 10,
        cumulative: true,
        watch: ['horizon', 'map'],
        onStart: (s, m) => {
          setRing(s, m, 6);
          m.hoverDevSum = 0;
          m.hoverAltSum = 0;
          m.hoverN = 0;
        },
        onTick: (s, m) => {
          m.hoverDevSum = (m.hoverDevSum ?? 0) + ringDist(s, m);
          m.hoverAltSum = (m.hoverAltSum ?? 0) + Math.abs(s.alt - (m.altRef ?? s.alt));
          m.hoverN = (m.hoverN ?? 0) + 1;
        },
        check: (s, m) => inRing(s, m) && s.alt > 3,
      },
      {
        text: 'Pitch forward until groundspeed reaches 6 m/s',
        tip: 'Nose down tilts the thrust forward. Watch the SPD tape climb.',
        watch: ['horizon', 'spdTape'],
        check: (s) => s.gs >= 6,
      },
      {
        text: 'Bank right past 12°',
        tip: 'Right stick to the right. The horizon line tilts the opposite way.',
        watch: ['horizon'],
        check: (s) => s.roll >= 12,
      },
      {
        text: 'Yaw the nose 90° from where it points now',
        tip: 'Left stick sideways. Yaw turns the nose without tilting the drone.',
        watch: ['heading', 'cam'],
        onStart: (s, m) => {
          m.yaw0 = s.yaw;
        },
        progress: (s, m) => Math.min(1, Math.abs(angleDiff(s.yaw, m.yaw0 ?? s.yaw)) / 90),
        check: (s, m) => Math.abs(angleDiff(s.yaw, m.yaw0 ?? s.yaw)) >= 90,
      },
      {
        text: 'Switch to POSHOLD and take your hands off',
        tip: 'Feel the autopilot catch the drone and hold it against the wind.',
        point: 'mode',
        hold: 3,
        watch: ['spdTape', 'map'],
        check: (s) => s.mode === 'POSHOLD' && handsOff(s) && s.gs < 1.2,
      },
    ],
    takeaway: 'Everything you just did was the thrust vector at work. Module 1 explains exactly why the drone moved the way it did.',
  },

  /* ---------------- Module 1 ---------------- */
  {
    id: 'lift-thrust',
    module: 'm1',
    code: '1.1',
    title: 'Lift & Thrust',
    skill: 'Altitude control',
    minutes: 3,
    par: 50,
    start: 'air',
    brief: {
      why: [
        'Four propellers push air down. When their combined thrust equals the drone\'s weight, it hovers. More RPM means more thrust than weight, so it climbs.',
        'In this sim the throttle stick commands a climb rate. Centered means "hold this altitude." Real STABILIZE on some aircraft is raw throttle, which is harder.',
        'A drone carries momentum vertically too. Ease off before you reach the target altitude or you will overshoot.',
      ],
      watch: ['ALT tape: your altitude above the launch point in metres.', 'VSI: vertical speed. Positive is climbing.'],
      chairFly: 'Picture the ALT tape rolling down to 20. At 23 m start easing the stick to center so you settle on 20 instead of sinking through it.',
      realWorld: 'The 400 ft (about 120 m) recreational ceiling is measured exactly like this tape: above ground level.',
    },
    objectives: [
      {
        text: 'Descend to 20 m and hold ±1.5 m for 4 s',
        tip: 'Left stick down. Start easing off around 23 m.',
        hold: 4,
        watch: ['altTape', 'vsi'],
        check: altHold(20, 1.5),
      },
      {
        text: 'Climb to 45 m and hold ±1.5 m for 4 s',
        tip: 'Up to 3 m/s climb. Watch the VSI fall back to 0 as you level off.',
        hold: 4,
        watch: ['altTape', 'vsi'],
        check: altHold(45, 1.5),
      },
    ],
    takeaway: 'Throttle is total thrust. Anticipate the target altitude; momentum carries you past it.',
  },
  {
    id: 'torque-yaw',
    module: 'm1',
    code: '1.2',
    title: 'Torque & Yaw',
    skill: 'Orientation',
    minutes: 3,
    par: 45,
    start: 'air',
    wind: 2,
    brief: {
      why: [
        'Two propellers spin clockwise and two counter-clockwise, so their torques cancel and the drone doesn\'t spin.',
        'To yaw, the flight controller speeds up one pair and slows the other. The leftover torque turns the airframe. Total thrust stays the same, so altitude and position barely change.',
        'After a turn, "forward" on the stick means wherever the nose now points. Pilots lose orientation here more than anywhere else.',
      ],
      watch: ['HEADING box and the compass strip in the Sim Cam.', 'Mission Map: the drone arrow shows where the nose points.'],
      chairFly: 'Imagine the drone facing you. Right stick right now moves it to YOUR left. Say it out loud until it feels natural.',
      realWorld: 'A slow pirouette is a classic field exercise for building nose-in orientation.',
    },
    objectives: [
      {
        text: 'Pirouette a full 360° while staying within 6 m',
        tip: 'Steady left-stick yaw. Pick one direction and keep going.',
        watch: ['heading', 'map'],
        onStart: (s, m) => {
          setRing(s, m, 6);
          m.lastYaw = s.yaw;
          m.yawAcc = 0;
        },
        onTick: (s, m) => {
          const d = angleDiff(s.yaw, m.lastYaw ?? s.yaw);
          m.lastYaw = s.yaw;
          m.yawAcc = inRing(s, m) ? (m.yawAcc ?? 0) + d : 0;
        },
        progress: (s, m) => Math.min(1, Math.abs(m.yawAcc ?? 0) / 360),
        check: (s, m) => Math.abs(m.yawAcc ?? 0) >= 360,
      },
      {
        text: 'Stop facing North (heading 350°–010°) for 2 s',
        tip: 'Ease off early. Yaw has momentum too.',
        hold: 2,
        watch: ['heading'],
        check: (s) => hdgNear(s, 0, 10),
      },
    ],
    takeaway: 'Yaw changes where the nose points, not where the drone goes. Always know which way the nose is facing.',
  },
  {
    id: 'thrust-vector',
    module: 'm1',
    code: '1.3',
    title: 'Thrust Vector Box',
    skill: 'Manual translation',
    minutes: 4,
    par: 80,
    start: 'air',
    wind: 3,
    brief: {
      why: [
        'Pitch forward and the rear motors speed up while the front ones slow. The drone tilts, and part of its thrust now points backward, which pushes you forward.',
        'Tilting borrows thrust from lift. In STABILIZE nothing brakes for you: to stop, you tilt the other way.',
        'The horizon on the PFD moves opposite to the aircraft. Nose down means the horizon line rises.',
      ],
      watch: ['Artificial Horizon pitch and bank.', 'SPD tape builds as you hold tilt.', 'Mission Map: your track against the four gates.'],
      chairFly: 'Fly the box in your head: forward, stop, right, stop, back, stop, left, stop. Each "stop" is a short opposite tilt.',
      realWorld: 'This is the box pattern from real multirotor training, flown without GPS help.',
    },
    objectives: [
      {
        text: 'Set MODE to STABILIZE (MANUAL)',
        point: 'mode',
        watch: ['mode'],
        onStart: (s, m) => startPoint(s, m),
        check: (s) => s.mode === 'STABILIZE',
      },
      {
        text: 'Gate 1: fly 40 m North of your start',
        tip: 'Face north first (heading 000°) so forward means north.',
        watch: ['horizon', 'map'],
        check: (s, m) => Math.hypot(s.e - (m.startE ?? 0), s.n - ((m.startN ?? 0) + 40)) < 7,
      },
      {
        text: 'Gate 2: 40 m East of Gate 1',
        watch: ['horizon', 'map'],
        check: (s, m) => Math.hypot(s.e - ((m.startE ?? 0) + 40), s.n - ((m.startN ?? 0) + 40)) < 7,
      },
      {
        text: 'Gate 3: 40 m South',
        watch: ['horizon', 'map'],
        check: (s, m) => Math.hypot(s.e - ((m.startE ?? 0) + 40), s.n - (m.startN ?? 0)) < 7,
      },
      {
        text: 'Gate 4: back to the start and stop (under 1.5 m/s)',
        tip: 'Counter-tilt to brake. Arrive slow.',
        watch: ['horizon', 'spdTape', 'map'],
        check: (s, m) => fromStart(s, m) < 7 && s.gs < 1.5,
      },
    ],
    takeaway: 'Tilt makes speed and counter-tilt takes it away. In manual flight, braking is your job.',
  },
  {
    id: 'precision-landing',
    module: 'm1',
    code: '1.4',
    title: 'Precision Landing',
    skill: 'Checkride',
    minutes: 4,
    par: 75,
    start: 'air',
    wind: 3,
    checkride: true,
    brief: {
      why: [
        'Landing combines everything: hold position, control the descent rate, and arrive gently.',
        'The ground effect zone and wind make the last few metres the hardest. Slow down well above the pad.',
        'Over 3 m/s at touchdown damages the airframe in this sim, just like a real one.',
      ],
      watch: ['DIST HOME box.', 'VSI during the final metres.', 'Mission Map pad (H).'],
      chairFly: 'Over the pad, descend at 1.5–2 m/s to 5 m, pause, then ease down. Hands stay ready to correct drift.',
      realWorld: 'A real checkride ends with a controlled landing on a marked spot.',
    },
    objectives: [
      {
        text: 'Fly back over the launch pad (DIST HOME under 3 m)',
        tip: 'POSHOLD is fine here. Use the map to line up.',
        watch: ['distHome', 'map'],
        check: (s) => s.distHome < 3,
      },
      {
        text: 'Land on the pad: within 3 m, touchdown under 1.5 m/s',
        tip: 'Slow down below 5 m. If you land off the pad, throttle up and try again.',
        watch: ['vsi', 'altTape', 'distHome'],
        onStart: (s, m) => markLogs(s, m),
        onTick: (s, m) => {
          const td = lastTouchdown(s, m);
          if (td != null && td !== m.touchdown) {
            m.touchdown = td;
            if (s.distHome >= 3) m.note = 'Off the pad. Throttle up and try again.';
            else if (td >= 1.5) m.note = `Touchdown at ${td.toFixed(1)} m/s is too firm. Lift off and try again.`;
          }
        },
        check: (s, m) => s.landed && s.distHome < 3 && m.touchdown != null && m.touchdown < 1.5,
      },
    ],
    takeaway: 'Good landings are decided above 5 m. Arrive slow, centred and stable.',
  },

  /* ---------------- Module 2 ---------------- */
  {
    id: 'read-hud',
    module: 'm2',
    code: '2.1',
    title: 'Reading the Cockpit',
    skill: 'Instrument scan',
    minutes: 4,
    par: 70,
    start: 'air',
    brief: {
      why: [
        'Out at range you can\'t see the drone\'s attitude by eye. The instruments are the truth.',
        'Pilots scan in a loop: horizon, speed, altitude, heading, battery, back to the horizon. Never stare at one gauge.',
        'Every number on the HUD comes from MAVLink messages streaming from the autopilot: ATTITUDE, VFR_HUD, GPS_RAW_INT and others.',
      ],
      watch: ['HEADING, SPD, ALT, VSI and DIST HOME.', 'MAVLink Stream: the raw messages behind each gauge.'],
      chairFly: 'Say your scan out loud while you fly: "horizon level, speed 8, altitude 50, heading 270, battery fine."',
      realWorld: 'Beyond about 150 m, a real drone is a dot. Pilots fly it by the instruments.',
    },
    objectives: [
      {
        text: 'Turn to heading 270° (West) ±8° and hold 2 s',
        hold: 2,
        watch: ['heading'],
        check: (s) => hdgNear(s, 270, 8),
      },
      {
        text: 'Climb to 50 m on the ALT tape (±2 m), hold 2 s',
        hold: 2,
        watch: ['altTape', 'vsi'],
        check: altHold(50, 2),
      },
      {
        text: 'Fly at 8 m/s on the SPD tape (±1.5) for 3 s',
        tip: 'Hold steady forward stick. POSHOLD tops out at 10 m/s.',
        hold: 3,
        watch: ['spdTape', 'mavlink'],
        check: (s) => Math.abs(s.gs - 8) <= 1.5,
      },
      {
        text: 'Keep going until DIST HOME reads 100 m or more',
        watch: ['distHome'],
        progress: (s) => Math.min(1, s.distHome / 100),
        check: (s) => s.distHome >= 100,
      },
    ],
    takeaway: 'Trust the instruments, and keep your eyes moving between them.',
  },
  {
    id: 'gust-recovery',
    module: 'm2',
    code: '2.2',
    title: 'Gust Recovery',
    skill: 'Manual correction',
    minutes: 4,
    par: 60,
    start: 'air',
    wind: 7,
    windFrom: 250,
    gusts: true,
    brief: {
      why: [
        'Wind shoves the airframe sideways. In POSHOLD the autopilot leans into it automatically using GPS.',
        'Gusts change strength every second. The autopilot reacts after it drifts, and so will you, so anticipate.',
        'Holding a lean into the wind is normal. A drone hovering in wind is never level.',
      ],
      watch: ['Artificial Horizon: the steady bank you need to hold position.', 'Mission Map: drift against the ring.'],
      chairFly: 'Wind from the west-southwest means you\'ll hold a little stick toward the west the whole time, and add more when a gust hits.',
      realWorld: 'Most consumer drones are rated to around 10 m/s of wind. Gusts are what catch new pilots.',
    },
    objectives: [
      {
        text: 'Set MODE to STABILIZE (MANUAL)',
        point: 'mode',
        watch: ['mode'],
        check: (s) => s.mode === 'STABILIZE',
      },
      {
        text: 'Stay within 8 m of this spot for 15 s total while gusts hit',
        tip: 'Lean into the wind. Correct early and small.',
        hold: 15,
        cumulative: true,
        watch: ['horizon', 'map'],
        onStart: (s, m) => setRing(s, m, 8),
        check: (s, m) => inRing(s, m),
      },
      {
        text: 'Switch to POSHOLD, hands off, and let it hold for 4 s',
        point: 'mode',
        hold: 4,
        watch: ['horizon'],
        check: (s) => s.mode === 'POSHOLD' && handsOff(s),
      },
    ],
    takeaway: 'Hovering in wind means holding a lean. Know what the autopilot is doing for you so you can do it yourself.',
  },
  {
    id: 'gps-loss',
    module: 'm2',
    code: '2.3',
    title: 'GPS Loss',
    skill: 'Failsafe takeover',
    minutes: 4,
    par: 75,
    start: 'air',
    wind: 3,
    brief: {
      why: [
        'POSHOLD, RTL and AUTO all depend on GPS. When the fix drops, the autopilot can no longer hold position.',
        'This sim does what ArduPilot does: an EKF failsafe switches to LAND and descends without position hold, drifting with the wind.',
        'The pilot\'s job is to take over in a non-GPS mode (STABILIZE) and fly by attitude until the fix returns.',
      ],
      watch: ['GPS status in the top bar (sats and fix).', 'Banner and MAVLink log: the FS message.', 'Mission Map: the position freezes when GPS is lost.'],
      chairFly: 'Say it: "GPS lost, mode STABILIZE, level the horizon, hold altitude." Rehearse reaching for the mode switch.',
      realWorld: 'GPS drops near tall buildings, under bridges, and in jamming zones. Practise STABILIZE often.',
    },
    objectives: [
      {
        text: 'Cruise 40 m away from where you start',
        watch: ['map', 'distHome'],
        onStart: (s, m) => startPoint(s, m),
        progress: (s, m) => Math.min(1, fromStart(s, m) / 40),
        check: (s, m) => fromStart(s, m) >= 40,
      },
      {
        text: 'GPS LOST. Take over: set MODE to STABILIZE',
        tip: 'The failsafe dropped you into LAND. Switch modes now, before it drifts down.',
        point: 'mode',
        watch: ['status', 'mode', 'mavlink'],
        onStart: (s, m, gcs) => gcs.setFault('gpsLoss', true),
        check: (s) => s.mode === 'STABILIZE',
      },
      {
        text: 'Hold within 10 m for 10 s by attitude alone',
        tip: 'The map is frozen. Fly the horizon and the Sim Cam view.',
        hold: 10,
        cumulative: true,
        watch: ['horizon', 'cam'],
        onStart: (s, m) => setRing(s, m, 10),
        check: (s, m) => inRing(s, m) && s.alt > 3,
      },
      {
        text: 'GPS is back (3D FIX). Re-engage POSHOLD',
        point: 'mode',
        watch: ['status', 'mode'],
        onStart: (s, m, gcs) => gcs.setFault('gpsLoss', false),
        check: (s) => s.mode === 'POSHOLD' && !s.gpsLoss,
      },
    ],
    takeaway: 'When GPS goes, the autopilot goes with it. STABILIZE is your way back.',
  },
  {
    id: 'link-loss',
    module: 'm2',
    code: '2.4',
    title: 'Link Loss & RTL',
    skill: 'Trust the failsafe',
    minutes: 5,
    par: 120,
    start: 'air',
    wind: 2,
    brief: {
      why: [
        'If the radio link drops, your sticks do nothing. The autopilot waits 5 seconds, then triggers Return-To-Launch.',
        'RTL climbs to a safe altitude (30 m here) before flying home, so it clears trees and buildings, then lands on the launch point.',
        'Your job is to not panic: confirm the failsafe engaged, watch it come home, and take over once the link is back.',
      ],
      watch: ['Top bar LINK status.', 'MODE changing to RTL.', 'ALT tape climbing to 30 m, then DIST HOME counting down.'],
      chairFly: 'Rehearse: "Link lost. Wait 5 seconds. RTL engaged. Climbing to 30. Heading home." Then: "Link back. I have control."',
      realWorld: 'Always set RTL altitude above the tallest obstacle in the area before you fly.',
    },
    objectives: [
      {
        text: 'Fly 70 m from home',
        watch: ['distHome', 'map'],
        progress: (s) => Math.min(1, s.distHome / 70),
        check: (s) => s.distHome >= 70,
      },
      {
        text: 'LINK LOST. Sticks are dead. Wait for the failsafe',
        tip: 'Don\'t touch anything. RTL should engage within 5 seconds.',
        watch: ['status', 'mavlink'],
        onStart: (s, m, gcs) => gcs.setFault('linkLoss', true),
        check: (s) => s.mode === 'RTL',
      },
      {
        text: 'Watch RTL climb to 30 m and fly home',
        watch: ['altTape', 'distHome', 'map'],
        progress: (s) => Math.max(0, Math.min(1, 1 - s.distHome / 70)),
        check: (s) => s.distHome < 8,
        onDone: (s, m, gcs) => gcs.setFault('linkLoss', false),
      },
      {
        text: 'Link restored. Land on the pad: let RTL finish or take over',
        watch: ['vsi', 'distHome'],
        check: (s) => s.landed && s.distHome < 5,
      },
    ],
    takeaway: 'A configured failsafe is your best crew member. Know what it will do before you need it.',
  },
  {
    id: 'emergency-checkride',
    module: 'm2',
    code: '2.5',
    title: 'Low Battery Checkride',
    skill: 'Checkride',
    minutes: 5,
    par: 110,
    start: 'air',
    wind: 5,
    gusts: true,
    checkride: true,
    brief: {
      why: [
        'Battery voltage sags under load and in cold weather. Below 25% this autopilot triggers an RTL failsafe; below 10% it lands wherever it is.',
        'Flying home into a headwind uses far more battery than flying out with it.',
        'Pass by bringing the drone home and landing it on the pad before the critical failsafe forces a landing somewhere else.',
      ],
      watch: ['Battery % in the top bar.', 'MODE and the FS banner.', 'DIST HOME and the wind.'],
      chairFly: 'Plan your turn-back point before you leave: half the battery to go out and come back, half as reserve.',
      realWorld: 'Real pilots land with 20–30% remaining. Plan for the headwind on the way home.',
    },
    objectives: [
      {
        text: 'Fly 90 m from home',
        watch: ['distHome', 'map'],
        progress: (s) => Math.min(1, s.distHome / 90),
        check: (s) => s.distHome >= 90,
      },
      {
        text: 'Battery sag! Watch the failsafe engage (below 25%)',
        watch: ['status', 'mavlink'],
        onStart: (s, m, gcs) => gcs.batterySag(3),
        check: (s) => s.mode === 'RTL' || s.mode === 'LAND' || s.soc < 0.25,
      },
      {
        text: 'Get it home and land on the pad before 10%',
        tip: 'RTL climbs first, which costs battery. Switching to POSHOLD and flying home low is faster.',
        watch: ['status', 'distHome', 'vsi'],
        check: (s) => s.landed && s.distHome < 5 && s.soc >= 0.1,
      },
    ],
    takeaway: 'Battery is a clock. Plan the return before you leave, and leave a reserve for the headwind.',
  },

  /* ---------------- Module 3 ---------------- */
  {
    id: 'aerial-photo',
    module: 'm3',
    code: '3.1',
    title: 'Cinematic Orbit',
    skill: 'Aerial photography',
    minutes: 5,
    par: 100,
    start: 'air',
    wind: 2,
    brief: {
      why: [
        'An orbit is a bank and a yaw at the same time. Roll moves you sideways around the subject while yaw keeps the camera pointed at it.',
        'The gimbal sets how steeply the camera looks down. Higher and farther means a shallower angle.',
        'Cinematic footage is about smoothness: slow, constant stick pressure, no jerks. Your score counts it.',
      ],
      watch: ['Sim Cam: keep the launch pad in frame.', 'Gimbal pitch slider.', 'Mission Map: a round, even circle.'],
      chairFly: 'Hold a little right roll and a little left yaw together, and keep both steady. The circle size comes from the ratio between them.',
      realWorld: 'Real-estate and tourism shoots use exactly this move to reveal a building or a landmark.',
    },
    objectives: [
      {
        text: 'Frame the launch pad in the Sim Cam for 3 s',
        tip: 'Tilt the gimbal down and yaw toward home. The pad is the green square.',
        point: 'gimbal',
        hold: 3,
        watch: ['cam'],
        check: (s) => s.padInFrame,
      },
      {
        text: 'Orbit the pad 360° with it in frame (radius 15–70 m)',
        tip: 'Roll and yaw together. Keep both inputs gentle and steady.',
        watch: ['cam', 'map'],
        onStart: (s, m) => {
          m.lastAng = Math.atan2(s.n, s.e);
          m.orbitAcc = 0;
        },
        onTick: (s, m) => {
          const ang = Math.atan2(s.n, s.e);
          let d = ((ang - (m.lastAng ?? ang)) * 180) / Math.PI;
          d = angleDiff(d, 0);
          m.lastAng = ang;
          if (s.padInFrame && s.distHome >= 15 && s.distHome <= 70) m.orbitAcc = (m.orbitAcc ?? 0) + d;
        },
        progress: (s, m) => Math.min(1, Math.abs(m.orbitAcc ?? 0) / 360),
        check: (s, m) => Math.abs(m.orbitAcc ?? 0) >= 360,
      },
      {
        text: 'Ease out: POSHOLD, hands off, 3 s',
        hold: 3,
        watch: ['cam'],
        check: (s) => s.mode === 'POSHOLD' && handsOff(s),
      },
    ],
    takeaway: 'Two inputs, held steady together. Smooth beats fast in every camera move.',
  },
  {
    id: 'search-rescue',
    module: 'm3',
    code: '3.2',
    title: 'Search & Rescue',
    skill: 'Thermal + AI detection',
    minutes: 6,
    par: 150,
    start: 'air',
    wind: 3,
    brief: {
      why: [
        'Thermal cameras see heat, not light. A person stands out against cool ground, even in shade or at night.',
        'The AI detector draws boxes with a confidence score. Fly lower or closer to raise confidence. The threshold slider filters out weak guesses.',
        'Search systematically, in lanes, so you never search the same ground twice.',
      ],
      watch: ['Sim Cam with THERMAL on.', 'AI Analytics: detector and confidence threshold.', 'LOCK TARGET once a PERSON box appears.'],
      chairFly: 'Picture a lawnmower pattern: fly a lane, step over one camera-width, fly back.',
      realWorld: 'Fire and rescue teams use exactly this combination of thermal and AI detection to find missing people.',
    },
    objectives: [
      {
        text: 'Switch the camera to THERMAL',
        point: 'thermal',
        watch: ['cam'],
        check: (s) => s.thermal,
      },
      {
        text: 'Search until the AI boxes a PERSON',
        tip: 'Gimbal around -40°, 25–40 m up. Fly slow lanes.',
        watch: ['cam', 'analytics', 'map'],
        check: (s) => s.detections.some((d) => d.label === 'PERSON'),
      },
      {
        text: 'LOCK TARGET on that person',
        point: 'lock',
        watch: ['cam'],
        onStart: (s, m) => {
          m.locked = [];
        },
        onTick: (s, m) => {
          if (s.target != null && s.targetType === 'person' && !(m.locked ?? []).includes(s.target)) {
            m.locked = [...(m.locked ?? []), s.target];
          }
        },
        check: (s, m) => (m.locked ?? []).length >= 1,
      },
      {
        text: 'Find and lock a second, different person',
        tip: 'Unlock, keep searching, lock again.',
        point: 'lock',
        watch: ['cam', 'map'],
        onTick: (s, m) => {
          if (s.target != null && s.targetType === 'person' && !(m.locked ?? []).includes(s.target)) {
            m.locked = [...(m.locked ?? []), s.target];
          }
        },
        progress: (s, m) => Math.min(1, (m.locked ?? []).length / 2),
        check: (s, m) => (m.locked ?? []).length >= 2,
      },
      {
        text: 'Search complete. Press RTL to come home',
        point: 'rtl',
        watch: ['status'],
        check: (s) => s.mode === 'RTL',
      },
    ],
    takeaway: 'Thermal finds the heat, the AI flags it, and the pilot confirms. A methodical pattern does the rest.',
  },
  {
    id: 'mapping',
    module: 'm3',
    code: '3.3',
    title: 'Autonomous Mapping',
    skill: 'Waypoint missions',
    minutes: 6,
    par: 180,
    start: 'pad',
    wind: 2,
    brief: {
      why: [
        'For mapping and surveys, the autopilot flies a pre-planned route more precisely than any hand. The pilot plans it and supervises.',
        'Each waypoint has a position and an altitude. Survey routes overlap so every patch of ground is photographed at least twice.',
        'The mission ends with RTL, so the drone comes home on its own. Supervising means watching battery, wind and the route the whole time.',
      ],
      watch: ['Mission Map and the waypoint list.', 'MODE: AUTO, then RTL.', 'MAVLink: "Reached WP" messages.'],
      chairFly: 'Walk the route on the map with your finger. Where would you take over if something went wrong?',
      realWorld: 'Survey and agriculture drones fly almost entirely on AUTO. The pilot\'s skill is in the plan and in staying ready to intervene.',
    },
    objectives: [
      {
        text: 'Add a waypoint so the mission has 6 or more',
        tip: 'Press + ADD WAYPOINT, then click the Mission Map where you want it. Set its altitude in the list.',
        point: 'addWp',
        watch: ['map'],
        check: (s) => s.waypointCount >= 6,
      },
      {
        text: 'Press EXECUTE to fly the mission on AUTO',
        point: 'exec',
        watch: ['map', 'mode'],
        check: (s) => s.mode === 'AUTO',
      },
      {
        text: 'Supervise: let it reach waypoint 3',
        watch: ['map', 'mavlink'],
        progress: (s) => Math.min(1, s.wpIndex / 3),
        check: (s) => s.wpIndex >= 3,
      },
      {
        text: 'Mission ends in RTL. Watch it land at home',
        watch: ['map', 'altTape'],
        onTick: (s, m) => {
          if (s.mode === 'RTL') m.sawRtl = true;
        },
        check: (s, m) => !!m.sawRtl && s.landed && s.distHome < 6,
      },
    ],
    takeaway: 'On AUTO, the pilot\'s job is to plan well and stay ready to take over.',
  },
];

export function lessonById(id: string) {
  return LESSONS.find((l) => l.id === id) ?? null;
}

export function lessonsIn(mod: ModuleId) {
  return LESSONS.filter((l) => l.module === mod);
}

// Learn-in-order gating: within a module each lesson unlocks the next, and
// each module unlocks once the previous one is finished. Module 3 missions
// are independent jobs, so they all open together.
export function isUnlocked(lesson: Lesson, done: Record<string, unknown>) {
  const idx = LESSONS.indexOf(lesson);
  if (idx <= 0) return true;
  if (lesson.module === 'm3') return lessonsIn('m2').every((l) => done[l.id]);
  return !!done[LESSONS[idx - 1].id];
}

export function nextLesson(done: Record<string, unknown>) {
  return LESSONS.find((l) => !done[l.id] && isUnlocked(l, done)) ?? null;
}
