// Mission 03, Deep Space Docking: the radio. Same engine as the other missions,
// its own beats. The procedure beats (the speed corridor, the hold at the
// approach gate, the capture latches) follow how real stations are approached;
// the people and the plot are fiction.

import { runScript } from './droneMission.ts';
import type { Beat, BaseFacts, MissionState, RadioLine, Script } from './droneMission.ts';
import type { CrashReason, Rating } from './docking.ts';

export interface DockingFacts extends BaseFacts {
  stage: 'rendezvous' | 'approach' | 'final' | 'docked' | 'crashed';
  /** distance to the port, m */
  range: number;
  /** closing rate, m/s */
  closing: number;
  /** the speed corridor at this range, m/s */
  allowed: number;
  /** offset from the port axis, m */
  offset: number;
  /** fuel, % */
  fuel: number;
  rating: Rating | null;
  reason: CrashReason | null;
}

const BEATS: Beat<DockingFacts>[] = [
  {
    key: 'brief1',
    who: 'CAPCOM',
    text: 'Drone, Mission Control. The pod made it to Shackleton, and now Halcyon Station needs you. Its docking guidance is dead, the crew of four are on a spare transponder, and you are carrying the replacement.',
    when: (f) => f.t > 1.5,
  },
  {
    key: 'brief2',
    who: 'NAV-AI',
    text: 'Range one hundred and twenty metres, closing at one and a half metres a second. I would like it noted that this is the only part of the day where going slower is the brave choice.',
    when: (f) => f.t > 9,
  },
  {
    key: 'station1',
    who: 'STATION',
    text: 'Halcyon: Commander Lindqvist. We have you on the window. The port is the ring with the green lights, and the cross inside it is your aim point.',
    when: (f) => f.stage === 'rendezvous' && f.t > 18,
  },
  {
    key: 'corridor',
    who: 'NAV-AI',
    text: 'The speed corridor tightens the closer you get. Watch the allowed rate on your panel: the nearer the station, the slower the limit.',
    when: (f) => f.stage === 'rendezvous' && f.range < 100 && f.t > 25,
  },
  {
    key: 'gate',
    who: 'CAPCOM',
    text: 'Approach gate, sixty metres. This is where you line the cross up with the port. Slide, do not steer, and keep your closing rate falling.',
    when: (f) => f.stage === 'approach',
  },
  {
    key: 'align',
    who: 'NAV-AI',
    text: 'Offset from the port axis is on the scope. Zero is the goal. Anything over half a metre at contact and you are docking with the hull.',
    when: (f) => f.stage === 'approach' && f.range < 40,
  },
  {
    key: 'fuel30',
    who: 'NAV-AI',
    text: 'Thruster propellant thirty percent. Small corrections, please.',
    when: (f) => f.stage !== 'docked' && f.stage !== 'crashed' && f.fuel <= 30,
  },
  {
    key: 'final',
    who: 'CAPCOM',
    text: 'Ten metres. Final closure. You want about ten centimetres a second here. Not a metre, not a metre a second.',
    when: (f) => f.stage === 'final',
  },
  {
    key: 'station2',
    who: 'STATION',
    text: 'Halcyon: we see the ring centred. Capture latches are armed. Easy now.',
    when: (f) => f.stage === 'final' && f.range < 5,
  },
  {
    key: 'fuel10',
    who: 'CAPCOM',
    text: 'Propellant is nearly gone, Drone. Whatever you do next, make it count.',
    when: (f) => f.stage !== 'docked' && f.stage !== 'crashed' && f.fuel <= 10,
  },
  { key: 'dock1', who: 'STATION', text: 'Halcyon: capture! Latches closed, hard dock confirmed. Welcome aboard, Drone. Commander Lindqvist says the coffee is terrible.', when: (f) => f.stage === 'docked' },
  { key: 'dock2', who: 'CAPCOM', text: 'Mission Control: Halcyon has her guidance back. Every console in the room is clapping.', when: (f) => f.stage === 'docked' },
  {
    key: 'smooth',
    who: 'NAV-AI',
    text: 'Closing under ten centimetres a second, ring centred. That is what the manual calls a textbook dock, and what I call a relief.',
    when: (f) => f.stage === 'docked' && f.rating === 'SMOOTH',
  },
  {
    key: 'good',
    who: 'NAV-AI',
    text: 'Inside the capture envelope. The latches did the rest.',
    when: (f) => f.stage === 'docked' && f.rating === 'GOOD',
  },
  {
    key: 'firm',
    who: 'NAV-AI',
    text: 'The latches caught it, barely. The station felt that one in the coffee.',
    when: (f) => f.stage === 'docked' && f.rating === 'FIRM',
  },
  {
    key: 'crash-speed',
    who: 'NAV-AI',
    text: 'Contact at the wrong speed. Past a few tenths of a metre a second the ports do not capture, they bounce. Debrief available on retry.',
    when: (f) => f.stage === 'crashed' && f.reason === 'SPEED',
  },
  {
    key: 'crash-align',
    who: 'NAV-AI',
    text: 'Contact off the port axis. That was the hull, not the ring. Debrief available on retry.',
    when: (f) => f.stage === 'crashed' && f.reason === 'ALIGN',
  },
  {
    key: 'crash-sway',
    who: 'NAV-AI',
    text: 'Contact with sideways drift on. The latches cannot grab a ring that is moving across them. Debrief available on retry.',
    when: (f) => f.stage === 'crashed' && f.reason === 'SWAY',
  },
  {
    key: 'crash-lost',
    who: 'NAV-AI',
    text: 'Range past three hundred metres and opening. The approach is over. Debrief available on retry.',
    when: (f) => f.stage === 'crashed' && f.reason === 'LOST',
  },
  { key: 'crash-cap', who: 'CAPCOM', text: 'Halcyon, stand by. We will fly up another transponder.', when: (f) => f.stage === 'crashed' },
];

const AMBIENT: Script<DockingFacts>['ambient'] = [
  { who: 'NAV-AI', text: 'Docking is ninety percent patience and ten percent not touching the stick.' },
  { who: 'STATION', text: 'Halcyon: the whole crew is at the window. Nobody is pretending to work.' },
  { who: 'CAPCOM', text: 'Slow is smooth, and smooth is fast. Somebody on the console wrote that on a sticky note.' },
];

export const DOCKING_SCRIPT: Script<DockingFacts> = { beats: BEATS, ambient: AMBIENT, quietStages: ['docked', 'crashed'] };

/** Run the radio for one tick of the approach; also nags when the drone closes too fast. */
export function dockingStep(m: MissionState, f: DockingFacts): RadioLine[] {
  return runScript(m, f, DOCKING_SCRIPT, (push, gap) => {
    if (f.stage === 'docked' || f.stage === 'crashed') return false;
    const fast = f.closing > f.allowed * 1.25 && f.range < 110;
    if (fast && f.t - m.lastOffTargetNag > 18 && gap >= 5.5) {
      m.lastOffTargetNag = f.t;
      push('NAV-AI', `Closing at ${f.closing.toFixed(2)} metres a second, and the corridor here is ${f.allowed.toFixed(2)}. Brake.`);
      return true;
    }
    return false;
  });
}
