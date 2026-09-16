// Shared shape for every "digital magazine" product spread (Star Tracker
// today; geology, ancient history, and climate telemetry are meant to be
// new SpreadConfig objects reusing the same DigitalMagazineSpread template
// and RadarCanvas engine — no new layout code per topic).

export interface RadarTarget {
  name: string;
  // -1..1 offsets from canvas center, matching the original canvas's own
  // ra/dec-as-screen-position convention.
  x: number;
  y: number;
  info: string;
  color: string;
}

export interface FeatureCard {
  index: string;
  title: string;
  body: string;
}

export interface StatTile {
  id: string;
  label: string;
  initialValue: string;
  initialBarPercent?: number;
  footerLabel: string;
  footerValue: string;
  jitter?: () => { value: string; barPercent?: number };
}

export interface TickerRow {
  id: string;
  leftTitle: string;
  leftSubtitle: string;
  rightTitle: string;
  rightSubtitle: string;
  highlighted?: boolean;
  // Live-jittering values, separate from the static leftTitle/rightTitle
  // above — id is a React key, not a DOM id (state-driven, not
  // direct-DOM-write like the original static page).
  liveValueId?: string;
  liveValueInitial?: string;
  liveValueJitter?: () => string;
  liveSubtitleId?: string;
  liveSubtitleInitial?: string;
  liveSubtitleJitter?: () => string;
}

export interface LocationOption {
  id: string;
  label: string;
  detail: string;
}

export interface AiHookPrompt {
  tag: string;
  label: string;
  text: string;
}

export interface AiHookConfig {
  badge: string;
  readyLabel: string;
  prompts: AiHookPrompt[];
}

export interface LiveClock {
  label: string;
  compute: (now: Date) => string;
}

export interface SpreadConfig {
  slug: string;
  pageTitle: string;
  liveBadgeLabel: string;
  liveBadgeValue: string;
  clocks: LiveClock[];

  heroTag: string;
  heroLines: string[];
  heroHighlightIndex: number;
  heroBody: string;
  ctaFeedLabel: string;
  ctaTelemetryLabel: string;

  aiHook: AiHookConfig;
  featureCards: FeatureCard[];

  feed: {
    kicker: string;
    title: string;
    locations: LocationOption[];
    quickFilters: string[];
    targets: RadarTarget[];
    hint: string;
    compassLabels: { n: string; s: string; e: string; w: string; nw: string; ne: string; center: string };
  };

  telemetry: {
    stats: StatTile[];
    statsIntervalMs: number;
    sourceLabel: string;
    sourceSubLabel: string;
    rows: TickerRow[];
    rowsIntervalMs: number;
  };

  backHref: string;
  backLabel: string;
}
