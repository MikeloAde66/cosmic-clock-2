// Mission 01 for the Space Drone: the radio script and the rules that trigger it.
// Pure functions only, so the story can be tested without a browser. Everything
// here is fiction; the flight numbers come from the simulated flight model.

export type Speaker = 'CAPCOM' | 'SURFACE' | 'NAV-AI';
export type Stage = 'acquire' | 'burn' | 'orbit' | 'done';

export interface RadioLine {
  id: number;
  who: Speaker;
  text: string;
  /** mission clock, seconds */
  at: number;
}

/** What every mission's script needs to know. */
export interface BaseFacts {
  t: number;
  stage: string;
  linkLost: boolean;
}

/** The slice of Mission 01 telemetry the script reacts to. */
export interface MissionFacts extends BaseFacts {
  stage: Stage;
  /** 0..1 of the single lap */
  orbit: number;
  altKm: number;
  /** angle between the nose and the Moon, degrees */
  facingDeg: number;
  linkLost: boolean;
}

export interface MissionState {
  sent: Set<string>;
  nextId: number;
  lastLineAt: number;
  ambient: number;
  offTargetSince: number | null;
  lastOffTargetNag: number;
}

export function newMission(): MissionState {
  return { sent: new Set(), nextId: 1, lastLineAt: -99, ambient: 0, offTargetSince: null, lastOffTargetNag: -99 };
}

export interface Beat<F extends BaseFacts = MissionFacts> {
  key: string;
  who: Speaker;
  text: string;
  when: (f: F) => boolean;
}

/** A mission's radio: story beats that fire once, plus small talk for quiet stretches. */
export interface Script<F extends BaseFacts> {
  beats: Beat<F>[];
  ambient: { who: Speaker; text: string }[];
  /** stages in which the small talk stays off */
  quietStages: string[];
}

const BEATS: Beat[] = [
  {
    key: 'brief1',
    who: 'CAPCOM',
    text: 'Drone, Mission Control. A solar flare is bearing down on Earth, and the Shackleton relay is our only way to warn eight million people in the path of the grid failure. We need you in lunar orbit.',
    when: (f) => f.t > 1.5,
  },
  {
    key: 'brief2',
    who: 'NAV-AI',
    text: 'Navigation online. The Moon is somewhere ahead, give or take. Point the nose at it and I will do the arithmetic.',
    when: (f) => f.t > 9,
  },
  {
    key: 'lock',
    who: 'NAV-AI',
    text: 'Lock acquired. Gravity well confirmed. Crew gravity: zero, as promised in the brochure.',
    when: (f) => f.stage !== 'acquire',
  },
  {
    key: 'burn',
    who: 'CAPCOM',
    text: 'Good lock, Drone. Begin the insertion burn: throttle above sixty percent and take her down to one hundred ten kilometres.',
    when: (f) => f.stage !== 'acquire' && f.t > 0,
  },
  {
    key: 'alt1000',
    who: 'NAV-AI',
    text: 'One thousand kilometres. The Moon is getting larger. I am told this is normal.',
    when: (f) => f.stage === 'burn' && f.altKm < 1000,
  },
  {
    key: 'alt400',
    who: 'SURFACE',
    text: 'Shackleton Base to Drone: I can see your burn from the ridge. Lovely. Please do not hit the antenna, it took us a month to build.',
    when: (f) => f.stage === 'burn' && f.altKm < 400,
  },
  {
    key: 'orbit',
    who: 'CAPCOM',
    text: 'Orbit achieved. One full lap and the relay gets its alignment. Eight million people, one lap. No pressure.',
    when: (f) => f.stage === 'orbit' || f.stage === 'done',
  },
  {
    key: 'o25',
    who: 'SURFACE',
    text: 'Dr. Okafor here. Solar particle count is climbing. Our dish is tracking you, so keep the Moon in the window.',
    when: (f) => f.orbit > 0.22,
  },
  {
    key: 'los',
    who: 'CAPCOM',
    text: 'Drone, you are about to pass behind the Moon. Radio silence on the far side. See you on the other side.',
    when: (f) => f.orbit > 0.38,
  },
  {
    key: 'aos',
    who: 'CAPCOM',
    text: 'Acquisition of signal. Drone, we hear you. Welcome back to the near side.',
    when: (f) => f.orbit > 0.56 && !f.linkLost,
  },
  {
    key: 'aos2',
    who: 'NAV-AI',
    text: 'I was not worried. I do not have that feature.',
    when: (f) => f.orbit > 0.6,
  },
  {
    key: 'o75',
    who: 'NAV-AI',
    text: 'The flare front reaches Earth in nineteen minutes. By my numbers you are doing wonderfully.',
    when: (f) => f.orbit > 0.72,
  },
  {
    key: 'o80',
    who: 'SURFACE',
    text: 'Okafor: relay is warming up. A third of the grid is already on standby. Keep going.',
    when: (f) => f.orbit > 0.82,
  },
  {
    key: 'done1',
    who: 'CAPCOM',
    text: 'Lap complete. Relay aligned. The deflection signal is going out to every grid on Earth.',
    when: (f) => f.stage === 'done',
  },
  {
    key: 'done2',
    who: 'SURFACE',
    text: 'Signal confirmed. The lights stay on, Drone. All eight million of them.',
    when: (f) => f.stage === 'done' && f.t > 0,
  },
  {
    key: 'done3',
    who: 'NAV-AI',
    text: 'Mission 01 complete. I recommend a moment of quiet appreciation. Then snacks.',
    when: (f) => f.stage === 'done' && f.t > 0,
  },
];

// Small talk for the long quiet stretches, used in order, once each.
const AMBIENT: { who: Speaker; text: string }[] = [
  { who: 'NAV-AI', text: 'Hull temperature nominal. Morale: also nominal. I checked.' },
  { who: 'CAPCOM', text: 'All stations, the grid operators report they are watching your telemetry. Try to look calm.' },
  { who: 'SURFACE', text: 'Okafor: the coffee machine here has just failed. Priorities are being reassessed.' },
  { who: 'NAV-AI', text: 'Reminder: there is no air out there. If you hear a sound, it is me.' },
  { who: 'CAPCOM', text: 'Every console in this room is green. Nobody has blinked in four minutes.' },
  { who: 'SURFACE', text: 'We are keeping a light on in the window for you, Drone.' },
];

/**
 * At most one line per call, with a small gap, so the radio never talks over
 * itself. `between` lets a mission add its own nag; it returns true if it spoke.
 */
export function runScript<F extends BaseFacts>(
  m: MissionState,
  f: F,
  script: Script<F>,
  between?: (push: (who: Speaker, text: string) => void, gap: number) => boolean,
): RadioLine[] {
  const out: RadioLine[] = [];
  const gap = f.t - m.lastLineAt;
  const push = (who: Speaker, text: string) => {
    out.push({ id: m.nextId++, who, text, at: f.t });
    m.lastLineAt = f.t;
  };

  // Nothing is transmitted while the far side of the Moon is in the way.
  if (f.linkLost) return out;

  if (gap >= 5.5) {
    const beat = script.beats.find((b) => !m.sent.has(b.key) && b.when(f));
    if (beat) {
      m.sent.add(beat.key);
      push(beat.who, beat.text);
      return out;
    }
  }

  if (between?.(push, gap)) return out;

  if (gap >= 32 && m.sent.size > 0 && !script.quietStages.includes(f.stage) && m.ambient < script.ambient.length) {
    const a = script.ambient[m.ambient++];
    push(a.who, a.text);
  }
  return out;
}

const MISSION_01: Script<MissionFacts> = { beats: BEATS, ambient: AMBIENT, quietStages: ['done'] };

export function missionStep(m: MissionState, f: MissionFacts): RadioLine[] {
  return runScript(m, f, MISSION_01, (push, gap) => {
    // Lost sight of the Moon mid-lap.
    if (f.stage !== 'orbit') return false;
    if (f.facingDeg > 60) {
      m.offTargetSince ??= f.t;
      if (f.t - m.offTargetSince > 3 && f.t - m.lastOffTargetNag > 25 && gap >= 5.5) {
        m.lastOffTargetNag = f.t;
        push('NAV-AI', 'The Moon has left the window. Turn back toward it or this lap does not count.');
        return true;
      }
    } else {
      m.offTargetSince = null;
    }
    return false;
  });
}
