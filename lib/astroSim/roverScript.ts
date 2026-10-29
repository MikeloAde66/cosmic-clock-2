// Mission 05, First Rover Drive: the radio. Same engine as the other missions,
// its own beats. The procedure beats (unstow, sample, relay pass) follow how
// real rover operations go; the people and the plot are fiction.

import { runScript } from './droneMission.ts';
import type { Beat, BaseFacts, MissionState, RadioLine, Script } from './droneMission.ts';
import type { Activity, FailReason, HazardKind, Rating } from './rover.ts';

export interface RoverFacts extends BaseFacts {
  stage: 'stowed' | 'driving' | 'complete' | 'failed';
  activity: Activity;
  /** targets sampled, 0..3 */
  samples: number;
  /** distance to the next target (or the relay point once all three are sampled), m */
  nextDist: number;
  /** the next stop is the relay point */
  relay: boolean;
  /** within reach of the next stop */
  inRange: boolean;
  battery: number;
  damage: number;
  tilt: number;
  /** the wheels are in soft sand */
  inPit: boolean;
  hazard: HazardKind | null;
  rating: Rating | null;
  reason: FailReason | null;
}

const BEATS: Beat<RoverFacts>[] = [
  {
    key: 'brief1',
    who: 'CAPCOM',
    text: 'Drone, Mission Control. Wren is on the ground and every one of us is still breathing. Now she has to earn her keep: three science targets, then the data goes home.',
    when: (f) => f.t > 1.5,
  },
  {
    key: 'brief2',
    who: 'SCIENCE',
    text: 'Science team: her mast and panels are still folded from the landing. Press Space and Wren will unstow. It takes a few seconds, and she will not be rushed.',
    when: (f) => f.stage === 'stowed' && f.t > 8,
  },
  {
    key: 'unstow',
    who: 'NAV-AI',
    text: 'Panels unfolding. Wren is stretching for the first time since she left Earth. I know the feeling, in a way.',
    when: (f) => f.activity === 'unstow',
  },
  {
    key: 'drive1',
    who: 'EDL',
    text: 'EDL: wheels are free. W and S drive, A and D steer. The first target is the red outcrop, a little to the east. Go gently, a rover has one set of wheels.',
    when: (f) => f.stage === 'driving',
  },
  {
    key: 'rock',
    who: 'NAV-AI',
    text: 'Boulder ahead. The wheels are tougher than they look, and still not tougher than a rock. Slow down and steer around it.',
    when: (f) => f.stage === 'driving' && f.hazard === 'rock',
  },
  {
    key: 'inrange',
    who: 'SCIENCE',
    text: 'Science team: that is the target. Stop, then press Space and hold still while the arm takes the sample. If the wheels move, the sample is lost.',
    when: (f) => f.stage === 'driving' && !f.relay && f.inRange && f.activity === 'none',
  },
  {
    key: 'sample1',
    who: 'SCIENCE',
    text: 'Science team: first sample is in the cache. The outcrop is old, red and full of iron. Somebody is very happy.',
    when: (f) => f.samples >= 1,
  },
  {
    key: 'crater',
    who: 'NAV-AI',
    text: 'Steep crater ahead. That wall is far past what the rover can tilt to. Go around the rim, never across.',
    when: (f) => f.stage === 'driving' && f.hazard === 'crater',
  },
  {
    key: 'tilt',
    who: 'NAV-AI',
    text: 'Tilt past eighteen degrees. The cameras say beautiful and the accelerometers say careful. Ease off the slope.',
    when: (f) => f.stage === 'driving' && f.tilt > 18,
  },
  {
    key: 'pit',
    who: 'NAV-AI',
    text: 'Soft sand under the wheels. Keep moving through it. If Wren sits still, she digs herself in.',
    when: (f) => f.stage === 'driving' && f.inPit,
  },
  {
    key: 'sample2',
    who: 'SCIENCE',
    text: 'Science team: layered rock, sample two. Every layer is a page from a very old book, and we only have the cover.',
    when: (f) => f.samples >= 2,
  },
  {
    key: 'batt30',
    who: 'NAV-AI',
    text: 'Battery thirty percent. Wren eats sunlight and I would like to point out that this is not a metaphor.',
    when: (f) => f.stage === 'driving' && f.battery <= 30,
  },
  {
    key: 'sample3',
    who: 'CAPCOM',
    text: 'Three samples in the cache. Now bring Wren to the relay point: the orbiter is about to pass overhead, and the dish needs to be still when it does.',
    when: (f) => f.samples >= 3 && f.stage === 'driving',
  },
  {
    key: 'inrangeRelay',
    who: 'CAPCOM',
    text: 'You are at the relay point. Stop and press Space. The dish needs six seconds with no wheels turning to push the data up.',
    when: (f) => f.stage === 'driving' && f.relay && f.inRange && f.activity === 'none',
  },
  {
    key: 'uplink',
    who: 'NAV-AI',
    text: 'Orbiter overhead, link is up. Hold perfectly still and let the numbers climb.',
    when: (f) => f.activity === 'uplink',
  },
  {
    key: 'batt10',
    who: 'CAPCOM',
    text: 'Battery ten percent, Drone. Nothing fancy from here on. Straight to the point.',
    when: (f) => f.stage === 'driving' && f.battery <= 10,
  },
  {
    key: 'done1',
    who: 'CAPCOM',
    text: 'Uplink complete. Every sample, every picture, every number from Wren is on its way to Earth.',
    when: (f) => f.stage === 'complete',
  },
  {
    key: 'done2',
    who: 'SCIENCE',
    text: 'Science team: data received, and it is better than the plan. First rover drive on a new world, and the rover is fine.',
    when: (f) => f.stage === 'complete',
  },
  {
    key: 'perfect',
    who: 'NAV-AI',
    text: 'Not a scratch on her and charge to spare. I would call that a model drive, but I am the model.',
    when: (f) => f.stage === 'complete' && f.rating === 'PERFECT',
  },
  {
    key: 'good',
    who: 'NAV-AI',
    text: 'A few knocks, a little battery, all the data. Wren has no complaints and nowhere to file them.',
    when: (f) => f.stage === 'complete' && f.rating === 'GOOD',
  },
  {
    key: 'safe',
    who: 'NAV-AI',
    text: 'Scraped, nearly flat, and the data got home. I will mark that as a success and not ask how.',
    when: (f) => f.stage === 'complete' && f.rating === 'SAFE',
  },
  {
    key: 'crash-wheels',
    who: 'NAV-AI',
    text: 'Too many hard hits and the wheels have given up. A boulder at speed is a boulder that wins. Debrief available on retry.',
    when: (f) => f.stage === 'failed' && f.reason === 'WHEELS',
  },
  {
    key: 'crash-rollover',
    who: 'NAV-AI',
    text: 'Wren tipped over on the crater wall. The wall was steeper than she can stand on. Go around the rim next time. Debrief available on retry.',
    when: (f) => f.stage === 'failed' && f.reason === 'ROLLOVER',
  },
  {
    key: 'crash-stuck',
    who: 'NAV-AI',
    text: 'Wren sat too long in the soft sand and dug herself in. Keep her moving through it, or go around. Debrief available on retry.',
    when: (f) => f.stage === 'failed' && f.reason === 'STUCK',
  },
  {
    key: 'crash-battery',
    who: 'NAV-AI',
    text: 'The battery is flat. Wren is parked, silent and sunny, and will stay that way. Drive straighter and spend less. Debrief available on retry.',
    when: (f) => f.stage === 'failed' && f.reason === 'BATTERY',
  },
  { key: 'crash-cap', who: 'CAPCOM', text: 'Science team, stand by. Wren has stopped transmitting.', when: (f) => f.stage === 'failed' },
];

const AMBIENT: Script<RoverFacts>['ambient'] = [
  { who: 'NAV-AI', text: 'For the record, Wren is going about two metres a second. The real one goes about four centimetres, and never complains.' },
  { who: 'SCIENCE', text: 'Science team: somebody has put a name on the red outcrop. I am not allowed to say what it is.' },
  { who: 'CAPCOM', text: 'Every console is on the rover camera. It is mostly rocks and nobody can look away.' },
];

export const ROVER_SCRIPT: Script<RoverFacts> = { beats: BEATS, ambient: AMBIENT, quietStages: ['complete', 'failed'] };

export function roverStep(m: MissionState, f: RoverFacts): RadioLine[] {
  return runScript(m, f, ROVER_SCRIPT);
}
