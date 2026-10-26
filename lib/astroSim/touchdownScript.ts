// Mission 02, Lunar Touchdown: the radio. Same engine as Mission 01, its own
// beats. The procedure beats (1202 alarm, high gate, low gate, "bingo" fuel)
// follow the Apollo descent; the people and the plot are fiction.

import type { Beat, BaseFacts, Script } from './droneMission.ts';
import type { CrashReason, Rating } from './touchdown.ts';

export interface TouchdownFacts extends BaseFacts {
  stage: 'braking' | 'approach' | 'final' | 'landed' | 'crashed';
  /** braking progress 0..1 */
  p: number;
  /** radar altitude, m */
  alt: number;
  /** fuel, % */
  fuel: number;
  rating: Rating | null;
  reason: CrashReason | null;
}

const BEATS: Beat<TouchdownFacts>[] = [
  {
    key: 'brief1',
    who: 'CAPCOM',
    text: 'Drone, Mission Control. The relay held and the flare has passed, but it cooked the Shackleton beacon, and the base is down to twelve hours of scrubber capacity. Your cargo pod carries the spares. Put it down beside the base.',
    when: (f) => f.t > 1.5,
  },
  {
    key: 'brief2',
    who: 'NAV-AI',
    text: 'Descent guidance online. A reminder that the Moon has no atmosphere, no runway and no sympathy. Hold the throttle above seventy-five percent and the braking burn takes care of itself.',
    when: (f) => f.t > 9,
  },
  {
    key: 'alarm',
    who: 'NAV-AI',
    text: 'Program alarm twelve-oh-two, executive overflow. Mission Control is calling it a go. It was a go for Apollo 11, and it is a go for us.',
    when: (f) => f.stage === 'braking' && f.p > 0.4,
  },
  {
    key: 'brake70',
    who: 'CAPCOM',
    text: 'You are giving back all the orbital speed you spent a whole lap building. Keep the burn steady.',
    when: (f) => f.stage === 'braking' && f.p > 0.7,
  },
  {
    key: 'highgate',
    who: 'CAPCOM',
    text: 'High gate. Pitch-over complete, the landing area is in your window. Cancel your drift and bring her to the cyan marker.',
    when: (f) => f.stage === 'approach' || f.stage === 'final',
  },
  {
    key: 'okafor1',
    who: 'SURFACE',
    text: 'Okafor: I have you in sight. The beacon is dead, so aim for the marker. Please, nothing exciting.',
    when: (f) => f.stage === 'approach' && f.alt < 2000,
  },
  {
    key: 'alt1000',
    who: 'NAV-AI',
    text: 'One thousand metres. Descent rate is now your business.',
    when: (f) => f.stage === 'approach' && f.alt < 1000,
  },
  {
    key: 'fuel30',
    who: 'NAV-AI',
    text: 'Fuel thirty percent. Treat that as a number, not a suggestion.',
    when: (f) => (f.stage === 'approach' || f.stage === 'final') && f.fuel <= 30,
  },
  {
    key: 'lowgate',
    who: 'CAPCOM',
    text: 'Low gate. Eyes on the dust, eyes on the rate.',
    when: (f) => f.stage === 'final',
  },
  {
    key: 'fuel15',
    who: 'CAPCOM',
    text: 'Bingo fuel. Land it, Drone.',
    when: (f) => (f.stage === 'approach' || f.stage === 'final') && f.fuel <= 15,
  },
  {
    key: 'alt30',
    who: 'SURFACE',
    text: 'Thirty metres. The dust is going to kick up. Trust the instruments.',
    when: (f) => f.stage === 'final' && f.alt < 30,
  },
  {
    key: 'alt10',
    who: 'NAV-AI',
    text: 'Contact in seconds. Gentle.',
    when: (f) => f.stage === 'final' && f.alt < 10,
  },
  { key: 'land1', who: 'CAPCOM', text: 'Touchdown. Drone is down. Shackleton, you have your pod.', when: (f) => f.stage === 'landed' },
  { key: 'land2', who: 'SURFACE', text: 'Okafor: contact, we see you. We are coming out for the pod. Thank you, Drone.', when: (f) => f.stage === 'landed' },
  {
    key: 'soft',
    who: 'NAV-AI',
    text: 'Sink rate under one metre a second. I am told that is how it is done.',
    when: (f) => f.stage === 'landed' && f.rating === 'SOFT',
  },
  {
    key: 'good',
    who: 'NAV-AI',
    text: 'Within the gear envelope. Not elegant, but nobody is arguing.',
    when: (f) => f.stage === 'landed' && f.rating === 'GOOD',
  },
  {
    key: 'hard',
    who: 'NAV-AI',
    text: 'The gear took that. Barely. Please do not describe it as a landing in the report.',
    when: (f) => f.stage === 'landed' && f.rating === 'HARD',
  },
  {
    key: 'crash-sink',
    who: 'NAV-AI',
    text: 'Impact. The sink rate was past what the gear can take. Debrief available on retry.',
    when: (f) => f.stage === 'crashed' && f.reason === 'SINK',
  },
  {
    key: 'crash-drift',
    who: 'NAV-AI',
    text: 'Impact. Sideways speed past the limit: the legs do not like sideways. Debrief available on retry.',
    when: (f) => f.stage === 'crashed' && f.reason === 'DRIFT',
  },
  {
    key: 'crash-fuel',
    who: 'NAV-AI',
    text: 'Fuel exhausted. Engine out. Debrief available on retry.',
    when: (f) => f.stage === 'crashed' && f.reason === 'FUEL',
  },
  { key: 'crash-cap', who: 'CAPCOM', text: 'Shackleton, stand by. We will launch another pod.', when: (f) => f.stage === 'crashed' },
];

const AMBIENT: Script<TouchdownFacts>['ambient'] = [
  { who: 'NAV-AI', text: 'For the record, I would like it noted that I suggested a bigger fuel tank.' },
  { who: 'SURFACE', text: 'Okafor: the whole base is at the window. Nobody is pretending to work.' },
  { who: 'CAPCOM', text: 'Every console in the room has gone quiet. That is the good kind of quiet.' },
];

export const TOUCHDOWN_SCRIPT: Script<TouchdownFacts> = { beats: BEATS, ambient: AMBIENT, quietStages: ['landed', 'crashed'] };
