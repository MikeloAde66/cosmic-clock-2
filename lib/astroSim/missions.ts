// The Space Drone mission list. Only playable missions can be started; the
// rest are on the roadmap and shown as such, never as if they existed.

export type MissionId = 'm01' | 'm02' | 'm03' | 'm04' | 'm05';

export interface MissionInfo {
  id: MissionId;
  number: string;
  title: string;
  blurb: string;
  /** the real procedure it is built on */
  basis: string;
  playable: boolean;
  /** needs the wide canopy cockpit (at least 900px across) */
  wideOnly: boolean;
}

export const MISSIONS: MissionInfo[] = [
  {
    id: 'm01',
    number: '01',
    title: 'Orbit Insertion',
    blurb: 'Lock on to the Moon, burn down to orbit, fly one full lap, and get through the radio blackout on the far side.',
    basis: 'Lunar orbit insertion and a lap with loss of signal behind the Moon, as on every Apollo mission.',
    playable: true,
    wideOnly: false,
  },
  {
    id: 'm02',
    number: '02',
    title: 'Lunar Touchdown',
    blurb: 'Brake out of orbit, watch the pitch-over reveal the landing site, then hover and drop the cargo pod beside Shackleton Base.',
    basis: 'The Apollo LM powered descent: braking, high gate near 7,600 ft, low gate, and the gear touchdown limits.',
    playable: true,
    wideOnly: true,
  },
  {
    id: 'm03',
    number: '03',
    title: 'Deep Space Docking',
    blurb: 'Bring the replacement transponder to Halcyon Station: close the range, line up the port, and touch down at a crawl. Closing too fast is the real enemy.',
    basis: 'Rendezvous and proximity operations: a speed corridor that tightens with range, then a final closure of centimetres per second.',
    playable: true,
    wideOnly: true,
  },
  {
    id: 'm04',
    number: '04',
    title: 'Mars Sky-Crane Landing',
    blurb: 'Atmospheric entry, supersonic parachute, then a rocket-powered crane lowering the craft on tethers.',
    basis: 'The Perseverance entry, descent and landing sequence.',
    playable: false,
    wideOnly: true,
  },
  {
    id: 'm05',
    number: '05',
    title: 'First Rover Drive',
    blurb: 'Land, deploy, drive, and explore another world.',
    basis: 'Rover unstow, traverse to science targets, and a data relay home.',
    playable: false,
    wideOnly: true,
  },
];

export function missionById(id: MissionId): MissionInfo {
  return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
}
