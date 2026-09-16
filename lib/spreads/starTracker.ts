import type { SpreadConfig } from './types';

// Content for the Star Tracker PRO spread — ported from
// protolabsglobal-main-shell's index.star.html. All numbers/readouts here
// are the same static mock values that file shipped with; only the
// structure changed (static HTML -> config consumed by
// DigitalMagazineSpread + RadarCanvas).
export const starTrackerSpread: SpreadConfig = {
  slug: 'star-tracker',
  pageTitle: 'Star Tracker PRO | Ai One',
  liveBadgeLabel: 'DSN LINK',
  liveBadgeValue: 'DSS23 GOLDSTONE — CAPS [ACTIVE]',
  clocks: [
    {
      label: 'GREENWICH SIDEREAL TIME',
      compute: (now) => {
        const secs = Math.floor(now.getTime() / 1000) % 86400;
        const h = String(Math.floor(secs / 3600)).padStart(2, '0');
        const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
        const s = String(secs % 60).padStart(2, '0');
        return `${h}:${m}:${s}`;
      },
    },
    {
      label: 'GAST LOCAL CLOCK',
      compute: (now) =>
        `GAST: ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}`,
    },
  ],

  heroTag: 'STANDALONE OBSERVATORY SUITE',
  heroLines: ['COMMAND THE', 'NIGHT SKY.'],
  heroHighlightIndex: 1,
  heroBody:
    'Step into the control room. Real-time deep space telemetry, orbital mechanics, and precision scope control mapped directly to your local horizon.',
  ctaFeedLabel: '[ INITIALIZE OBSERVATORY FEED ]',
  ctaTelemetryLabel: '[ VIEW LIVE DSN TELEMETRY ]',

  aiHook: {
    badge: 'KALI AI // VOICE & COMMAND INTERFACE',
    readyLabel: 'NEURAL LINK READY',
    prompts: [
      {
        tag: '[Novice]',
        label: '3 Visible Messier Targets',
        text: "I'm new to deep-sky observation. What are three bright Messier targets visible tonight?",
      },
      {
        tag: '[Novice]',
        label: 'Web Serial Mount Setup',
        text: 'Can you walk me through setting up a Web Serial connection to align my telescope mount?',
      },
      {
        tag: '[Adv]',
        label: 'Radio & DSN Telemetry Stream',
        text: 'Explain how to stream live radio signals alongside DSN telemetry with low latency.',
      },
      {
        tag: '[Adv]',
        label: 'LX200 Web Serial GOTO Script',
        text: 'Write a JavaScript function using Web Serial API to send LX200 GOTO commands.',
      },
    ],
  },

  featureCards: [
    {
      index: '01 / DSN DOWNLINK',
      title: '01 / DSN DOWNLINK',
      body: "Live signal band, data rate, and one-way light-time direct from NASA's real Deep Space Network telemetry feeds.",
    },
    {
      index: '02 / LX200 & NEXSTAR',
      title: '02 / LX200 & NEXSTAR',
      body: 'Real mount control over Web Serial or Bluetooth — live position polling, GOTO/slew mechanics, and tracking rate locking.',
    },
    {
      index: '03 / SPECTRAL OVERLAYS',
      title: '03 / SPECTRAL OVERLAYS',
      body: 'Multi-wavelength sky mapping across optical, infrared (JWST), radio (21cm hydrogen), and high-energy X-ray bands.',
    },
  ],

  feed: {
    kicker: 'SKY ABOVE YOU',
    title: 'Star Tracker PRO',
    locations: [
      { id: 'mauna', label: "Mauna Kea Observatories (Hawai'i, USA)", detail: 'Mauna Kea Observatories — 19.82°, -155.47° · Elev 4207m' },
      { id: 'palomar', label: 'Palomar Observatory (California, USA)', detail: 'Palomar Observatory — 33.35°, -116.86° · Elev 1706m' },
      { id: 'greenwich', label: 'Royal Observatory Greenwich (London, UK)', detail: 'Royal Observatory Greenwich — 51.47°, 0.00° · Elev 46m' },
      { id: 'griffith', label: 'Griffith Observatory (Los Angeles, USA)', detail: 'Griffith Observatory — 34.11°, -118.30° · Elev 346m' },
      { id: 'vlt', label: 'Very Large Telescope (VLT) (Atacama, Chile)', detail: 'Very Large Telescope (VLT) — -24.62°, -70.40° · Elev 2635m' },
    ],
    quickFilters: ['ISS', 'SPACE WEATHER', 'MESSIER DEEP-SKY', 'SKY FEST'],
    targets: [
      { name: 'Saturn', x: 0.35, y: 0.25, info: 'E 20.8° · 8.504 AU', color: '#67e8f9' },
      { name: 'M51', x: -0.38, y: 0.45, info: 'Whirlpool Galaxy · Mag 8.4', color: '#c084fc' },
      { name: 'M31', x: 0.48, y: -0.18, info: 'Andromeda Galaxy · 2.5M ly', color: '#c084fc' },
      { name: 'M13', x: -0.22, y: -0.28, info: 'Hercules Cluster · Mag 5.8', color: '#c084fc' },
      { name: 'M57', x: -0.1, y: -0.12, info: 'Ring Nebula · Mag 8.8', color: '#c084fc' },
      { name: 'M27', x: 0.08, y: -0.38, info: 'Dumbbell Nebula · Mag 7.5', color: '#c084fc' },
    ],
    hint: 'Click targets (M51, M31, Saturn) to focus scope',
    compassLabels: { n: 'N', s: 'S', e: 'E', w: 'W', nw: 'NW', ne: 'NE', center: 'ZENITH' },
  },

  telemetry: {
    stats: [
      {
        id: 'pingValue',
        label: 'MICROSERVICE LATENCY',
        initialValue: '142 ms',
        initialBarPercent: 28,
        footerLabel: 'ENDPOINT:',
        footerValue: 'kali-quantum-service',
        jitter: () => {
          const lat = 135 + Math.floor(Math.random() * 20);
          return { value: `${lat} ms`, barPercent: Math.min(100, Math.max(10, (lat / 300) * 100)) };
        },
      },
    ],
    statsIntervalMs: 2500,
    sourceLabel: 'LIVE FROM NASA/JPL DEEP SPACE NETWORK',
    sourceSubLabel: 'GOLDSTONE STATION',
    rows: [
      {
        id: 'dsnUplink',
        leftTitle: 'DSS23 · uplink',
        leftSubtitle: 'CAPS NODE',
        rightTitle: 'S-band · —',
        rightSubtitle: 'one-way light-time unavailable',
        liveSubtitleId: 'dsnUpDbm',
        liveSubtitleInitial: '2 dBm',
        liveSubtitleJitter: () => `${2 + Math.floor(Math.random() * 3 - 1)} dBm`,
      },
      {
        id: 'dsnDownlink',
        leftTitle: 'DSS23 · downlink',
        leftSubtitle: 'CAPS NODE',
        rightTitle: 'X-band',
        rightSubtitle: 'telemetry lock nominal',
        highlighted: true,
        liveValueId: 'dsnKbps',
        liveValueInitial: '256.0 kbps',
        liveValueJitter: () => `${(256 + (Math.random() * 4 - 2)).toFixed(1)} kbps`,
        liveSubtitleId: 'dsnDownDbm',
        liveSubtitleInitial: '-120 dBm',
        liveSubtitleJitter: () => `${-120 + Math.floor(Math.random() * 3 - 1)} dBm`,
      },
    ],
    rowsIntervalMs: 1800,
  },

  backHref: '/',
  backLabel: 'BACK TO PRODUCTS',
};
