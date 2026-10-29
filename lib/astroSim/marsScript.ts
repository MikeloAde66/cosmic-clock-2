// Mission 04, Mars Sky-Crane Landing: the radio. Same engine as the other
// missions, its own beats. The procedure beats (entry interface, peak
// deceleration, parachute, backshell separation, the sky-crane gate and the cord
// cut) follow the real Mars landing sequence; the people and the plot are fiction.

import { runScript } from './droneMission.ts';
import type { Beat, BaseFacts, MissionState, RadioLine, Script } from './droneMission.ts';
import type { CrashReason, Rating } from './mars.ts';
import { RANGE_OK } from './mars.ts';

export interface MarsFacts extends BaseFacts {
  stage: 'entry' | 'chute' | 'powered' | 'crane' | 'landed' | 'crashed';
  /** altitude, m */
  alt: number;
  /** deceleration, Earth g */
  g: number;
  /** predicted landing error at the parachute gate, m (positive = long); null when not in entry */
  rangeErr: number | null;
  fuel: number;
  /** the rover's wheels are on the ground */
  down: boolean;
  rating: Rating | null;
  reason: CrashReason | null;
}

const BEATS: Beat<MarsFacts>[] = [
  {
    key: 'brief1',
    who: 'CAPCOM',
    text: 'Drone, Mission Control. Halcyon has its guidance back, and the next job is down on Mars. Rover Wren is in the aeroshell behind you, and you are the one flying the entry.',
    when: (f) => f.t > 1.5,
  },
  {
    key: 'brief2',
    who: 'NAV-AI',
    text: 'Entry interface ahead. Seven minutes of terror, which Mission Control has compressed to a few for your convenience.',
    when: (f) => f.t > 9,
  },
  {
    key: 'entry1',
    who: 'EDL',
    text: 'EDL: you have the lift stick. Lift up stretches the trajectory, lift down shortens it. The scope shows where you are headed against the target.',
    when: (f) => f.stage === 'entry' && f.alt < 118000 && f.t > 15,
  },
  {
    key: 'peak',
    who: 'NAV-AI',
    text: 'Peak deceleration. The heat shield is at a few thousand degrees and doing exactly what it was built for.',
    when: (f) => f.stage === 'entry' && f.g >= 7,
  },
  {
    key: 'haze',
    who: 'NAV-AI',
    text: 'Dust haze in the upper air. The density is a touch off the forecast, so trust the predictor over the plan.',
    when: (f) => f.stage === 'entry' && f.alt < 62000 && f.alt > 40000 && f.t > 25,
  },
  {
    key: 'late',
    who: 'CAPCOM',
    text: 'Thirty kilometres. The parachute opens at eleven, and you want to arrive slow enough and close enough to the target.',
    when: (f) => f.stage === 'entry' && f.alt < 30000,
  },
  {
    key: 'chute1',
    who: 'CAPCOM',
    text: 'Parachute deployed. Mission Control calls that a clean opening. The drone calls it a surprise.',
    when: (f) => f.stage === 'chute',
  },
  {
    key: 'sepTip',
    who: 'NAV-AI',
    text: 'Backshell separation is your call. Let go high and the engines burn fuel you will want later. Let go low and there is no room to stop. About two kilometres is textbook.',
    when: (f) => f.stage === 'chute' && f.alt < 4500,
  },
  {
    key: 'sepAuto',
    who: 'CAPCOM',
    text: 'Fifteen hundred metres. Separate now, Drone, or the system will do it for you at nine hundred.',
    when: (f) => f.stage === 'chute' && f.alt < 1500,
  },
  {
    key: 'powered1',
    who: 'EDL',
    text: 'EDL: backshell is away, engines lit. You are flying the descent stage now. Throttle is your descent rate.',
    when: (f) => f.stage === 'powered',
  },
  {
    key: 'powered2',
    who: 'NAV-AI',
    text: 'Steer to the cyan marker. Wren has to go down on flat ground, and the marker is the only flat ground I trust.',
    when: (f) => f.stage === 'powered' && f.alt < 1200,
  },
  {
    key: 'fuel30',
    who: 'NAV-AI',
    text: 'Propellant thirty percent. Treat that as a number, not a suggestion.',
    when: (f) => (f.stage === 'powered' || f.stage === 'crane') && f.fuel <= 30,
  },
  {
    key: 'gate',
    who: 'EDL',
    text: 'EDL: sky-crane gate at twenty-five metres. Slow to a hover over the marker, under two metres a second both ways, and the crane takes over.',
    when: (f) => f.stage === 'powered' && f.alt < 120,
  },
  {
    key: 'fuel10',
    who: 'CAPCOM',
    text: 'Propellant nearly gone, Drone. Whatever you do next, make it count.',
    when: (f) => (f.stage === 'powered' || f.stage === 'crane') && f.fuel <= 10,
  },
  {
    key: 'crane1',
    who: 'EDL',
    text: 'EDL: sky crane! Wren is coming down on the cables. Hold still, and do not make me explain a swinging rover.',
    when: (f) => f.stage === 'crane',
  },
  {
    key: 'down1',
    who: 'EDL',
    text: 'EDL: wheels on Mars. Cut the cords when you are ready.',
    when: (f) => f.stage === 'crane' && f.down,
  },
  { key: 'land1', who: 'CAPCOM', text: 'Cords cut, descent stage flying away. Wren is on Mars.', when: (f) => f.stage === 'landed' },
  { key: 'land2', who: 'EDL', text: 'EDL: we have the first picture. It is a rock, and it is the best rock any of us has ever seen.', when: (f) => f.stage === 'landed' },
  {
    key: 'perfect',
    who: 'NAV-AI',
    text: 'On the marker, with no swing. I will deny that I was nervous.',
    when: (f) => f.stage === 'landed' && f.rating === 'PERFECT',
  },
  {
    key: 'good',
    who: 'NAV-AI',
    text: 'Close to the marker and nothing broken. The rover has no complaints and nowhere to file them.',
    when: (f) => f.stage === 'landed' && f.rating === 'GOOD',
  },
  {
    key: 'safe',
    who: 'NAV-AI',
    text: 'Down and rolling, though a long way from the marker. The science team will drive.',
    when: (f) => f.stage === 'landed' && f.rating === 'SAFE',
  },
  {
    key: 'crash-skip',
    who: 'NAV-AI',
    text: 'The capsule skipped off the atmosphere like a stone on a pond. Lift down earlier next time. Debrief available on retry.',
    when: (f) => f.stage === 'crashed' && f.reason === 'SKIP',
  },
  {
    key: 'crash-overload',
    who: 'NAV-AI',
    text: 'Deceleration past what the capsule can take. Too steep, too long with the lift pointed down. Debrief available on retry.',
    when: (f) => f.stage === 'crashed' && f.reason === 'OVERLOAD',
  },
  {
    key: 'crash-fast',
    who: 'NAV-AI',
    text: 'Still far too fast at eleven kilometres. The parachute tore open and came apart. More lift earlier slows you down. Debrief available on retry.',
    when: (f) => f.stage === 'crashed' && f.reason === 'FAST',
  },
  {
    key: 'crash-miss',
    who: 'NAV-AI',
    text: 'Too far from the target when the chute opened. The descent stage cannot reach the site from here. Debrief available on retry.',
    when: (f) => f.stage === 'crashed' && f.reason === 'MISS',
  },
  {
    key: 'crash-ground',
    who: 'NAV-AI',
    text: 'The descent stage hit the ground with the rover still on board. Debrief available on retry.',
    when: (f) => f.stage === 'crashed' && f.reason === 'GROUND',
  },
  {
    key: 'crash-swing',
    who: 'NAV-AI',
    text: 'The stage was moving too much and the rover swung on its cables. Debrief available on retry.',
    when: (f) => f.stage === 'crashed' && f.reason === 'SWING',
  },
  {
    key: 'crash-snag',
    who: 'NAV-AI',
    text: 'The rover was down and the cords were never cut. The stage ran out of patience, and propellant. Debrief available on retry.',
    when: (f) => f.stage === 'crashed' && f.reason === 'SNAG',
  },
  { key: 'crash-cap', who: 'CAPCOM', text: 'EDL team, stand by. We will build another rover.', when: (f) => f.stage === 'crashed' },
];

const AMBIENT: Script<MarsFacts>['ambient'] = [
  { who: 'NAV-AI', text: 'For the record, Mars has landed more of our spacecraft than it has welcomed.' },
  { who: 'EDL', text: 'EDL: the whole team is standing. Nobody can sit down during a landing, it is bad luck.' },
  { who: 'CAPCOM', text: 'Every console in the room has gone quiet. That is the good kind of quiet.' },
];

export const MARS_SCRIPT: Script<MarsFacts> = { beats: BEATS, ambient: AMBIENT, quietStages: ['landed', 'crashed'] };

/** Run the radio for one tick; also warns when the predicted entry range is off. */
export function marsStep(m: MissionState, f: MarsFacts): RadioLine[] {
  return runScript(m, f, MARS_SCRIPT, (push, gap) => {
    if (f.stage !== 'entry' || f.rangeErr === null || f.t < 40) return false;
    if (Math.abs(f.rangeErr) > RANGE_OK && f.t - m.lastOffTargetNag > 24 && gap >= 5.5) {
      m.lastOffTargetNag = f.t;
      const km = Math.round(Math.abs(f.rangeErr) / 1000);
      push('NAV-AI', f.rangeErr > 0 ? `Predicted landing ${km} kilometres long. Lift down to shorten the range.` : `Predicted landing ${km} kilometres short. Lift up to stretch the range.`);
      return true;
    }
    return false;
  });
}
