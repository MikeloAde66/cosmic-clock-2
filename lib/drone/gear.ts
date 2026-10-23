// Recommended gear and courses on the /drone page.
//
// To go live with an affiliate program, paste your affiliate URL into `href`.
// While `href` is empty the card shows "Link coming soon" and isn't clickable,
// so nothing ever points at a dead or made-up link. Keep the `why` line
// honest: it's the reason we'd recommend the item, not ad copy.

export interface GearItem {
  name: string;
  why: string;
  tag: string;
  href: string;
}

export const GEAR: GearItem[] = [
  {
    name: 'Beginner drone under 250 g',
    why: 'Light enough that US recreational flyers don\'t need to register it with the FAA, and forgiving to learn on.',
    tag: 'Drone',
    href: '',
  },
  {
    name: 'USB controller or RC transmitter',
    why: 'Plug it in and fly the Spectre-AI simulator with real sticks instead of a keyboard. Builds the muscle memory you\'ll use outdoors.',
    tag: 'Simulator',
    href: '',
  },
  {
    name: 'Spare batteries + charging hub',
    why: 'A battery usually lasts 20–30 minutes in the air. A few spares and a hub that charges them in turn make it a real session.',
    tag: 'Power',
    href: '',
  },
  {
    name: 'ND filter set',
    why: 'Cuts glare and lets the camera use a slower shutter for the smooth, cinematic footage you practise in Module 3.',
    tag: 'Camera',
    href: '',
  },
  {
    name: 'Hard-shell carry case',
    why: 'Protects the props, gimbal and batteries in a bag or on a flight.',
    tag: 'Travel',
    href: '',
  },
  {
    name: 'Foldable landing pad',
    why: 'A clean, visible spot for takeoff and landing that keeps dust and grass out of the motors.',
    tag: 'Field',
    href: '',
  },
];

export interface CertLink {
  name: string;
  why: string;
  href: string;
  cta: string;
  /** Third-party course links that may earn a commission (vs. official FAA pages). */
  affiliate: boolean;
}

export const CERTIFICATION: CertLink[] = [
  {
    name: 'FAA TRUST certificate',
    why: 'Free online test that every US recreational flyer must pass before flying. About 30 minutes, no fail.',
    href: 'https://www.faa.gov/uas/recreational_flyers/knowledge_test_updates',
    cta: 'faa.gov',
    affiliate: false,
  },
  {
    name: 'B4UFLY airspace check',
    why: 'The FAA\'s free tool for checking whether you can fly where you are standing.',
    href: 'https://www.faa.gov/uas/getting_started/b4ufly',
    cta: 'faa.gov',
    affiliate: false,
  },
  {
    name: 'Part 107 Remote Pilot Certificate',
    why: 'Required to fly for work or business in the US. The FAA explains the knowledge test and how to register.',
    href: 'https://www.faa.gov/uas/commercial_operators/become_a_drone_pilot',
    cta: 'faa.gov',
    affiliate: false,
  },
  {
    name: 'Part 107 prep course',
    why: 'A structured course with practice exams for the Part 107 knowledge test.',
    href: '',
    cta: 'Course',
    affiliate: true,
  },
];

export const HAS_AFFILIATE_LINKS = GEAR.some((g) => g.href) || CERTIFICATION.some((c) => c.affiliate && c.href);
