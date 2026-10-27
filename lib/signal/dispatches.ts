// Signal: the dispatches, as data. Nothing here is live: the explainers are
// general background written without cited sources, and the two sample
// dispatches (the earnings brief and the supply chain tracker) use made-up,
// illustrative companies and figures. The page labels each one accordingly.

export type DispatchKind = 'explainer' | 'sample';

export interface Dispatch {
  id: string;
  tag: string;
  /** a tag shown in amber, for the recurring "live format" columns */
  live?: boolean;
  kind: DispatchKind;
  headline: string;
  dek: string;
  readTime: string;
  byline: string[];
  body: string[];
  callout?: { k: string; text: string };
  /** numbered items for the earnings brief */
  brief?: { num: string; h: string; p: string }[];
  /** status rows for the supply chain tracker */
  ticker?: { status: 'elevated' | 'stable' | 'easing'; h: string; p: string }[];
  /** illustrated scenes, shown one at a time with captions that follow the recording */
  visual?: Visual;
}

/** Scene pictures must be free of baked-in captions; the caption band is drawn separately. */
export interface Visual {
  /** CSS aspect-ratio of the frame when it is not the default wide strip, e.g. '1376 / 768' */
  aspect?: string;
  /** replaces the default picture label when the pictures are not AI illustrations */
  note?: string;
  scenes: {
    /** a picture file, or a chart drawn in code (see components/signal/ChartScenes) */
    src?: string;
    chart?: string;
    alt: string;
    /** one picture shared by every scene: the camera moves to this spot (0..1 of the picture) and zoom */
    view?: { x: number; y: number; zoom: number };
    /** CSS object-position when the picture is cropped to the frame, e.g. '50% 30%' */
    pos?: string;
    /** the part of the script this scene opens on (see scriptParts): head, body:N, callout ... */
    from: string;
  }[];
}

export const DISPATCHES: Dispatch[] = [
  {
    id: 'tariff-tax',
    tag: 'MARKETS',
    headline: 'The Hidden Tariff Tax',
    dek: "You never see it on a receipt, but it's already in your cart.",
    readTime: '4 MIN',
    byline: ['PROTO LABS DESK', 'TRADE & PRICING'],
    body: [
      "A tariff is a tax collected at the border, but almost nobody who pays it stands at the border. It lands on the importer first, who faces three choices: eat the cost, pass it to the customer, or split the difference. Most companies end up doing all three, in proportions that shift with every quarter's margin pressure.",
      "Economists who've studied past rounds of tariffs generally find businesses absorb roughly half the added cost through thinner margins before the rest moves downstream — first to retailers, then to shelf prices. The lag matters: a tariff announced today can take two or three ordering cycles to show up at checkout, which is exactly long enough for the policy debate to have moved on by the time the bill arrives.",
      "The part that rarely gets said out loud: 'someone else will pay it' is a political framing, not an economic one. A tariff doesn't choose a payer. It sets a price floor, and the market finds the cheapest way to clear it — sometimes a supplier, sometimes a retailer, most often, eventually, the person buying the thing.",
    ],
    callout: {
      k: 'WHAT TO WATCH',
      text: "Earnings-call language is an early tell. When a CFO says 'pricing actions' instead of 'price increases,' that's usually a tariff pass-through in progress.",
    },
    kind: 'explainer',
    visual: {
      scenes: [
        { src: '/signal-visuals/tariff-tax-1.webp', alt: 'A shopping cart with a receipt and a percent tag, and the words "price floor".', from: 'head' },
        { src: '/signal-visuals/tariff-tax-2.webp', alt: 'A diagram: a ship at the border, an importer choosing to eat the cost, pass it down or split it, and a clock showing the months before shelf prices rise.', from: 'body:0' },
        { src: '/signal-visuals/tariff-tax-3.webp', alt: 'A boardroom with a rising chart: a CFO saying "pricing actions" translates to a tariff pass-through in progress.', from: 'callout' },
      ],
    },
  },
  {
    id: 'fed-401k',
    tag: 'MARKETS',
    headline: 'Your 401(k) vs. The Fed',
    dek: 'One sentence from the Federal Reserve chair can move trillions overnight.',
    readTime: '3 MIN',
    byline: ['PROTO LABS DESK', 'RATES & RETIREMENT'],
    body: [
      'Most retirement accounts are built on index funds, and index funds are priced off a simple idea: a stock is worth the cash it will eventually pay out, discounted back to today. The discount rate comes, indirectly, from the Fed. Raise rates, and future cash flows are worth less today — valuations compress, even if nothing about the underlying businesses changed that afternoon.',
      "That's why a press conference can move a 401(k) balance more than a full quarter of the owner's own saving. The mechanism isn't mysterious, it's just invisible: nobody sends you a notice that says 'your discount rate changed,' you just see the number on the statement move.",
      "The practical takeaway isn't to trade around Fed meetings — timing rate decisions is a losing game even for professionals. It's to understand why a balance can swing on a day you did nothing, so a bad month doesn't get mistaken for a bad plan.",
    ],
    callout: {
      k: 'THE MECHANISM',
      text: 'Growth stocks, whose cash flows sit furthest in the future, are mathematically the most sensitive to rate changes — which is why they tend to move hardest on Fed days.',
    },
    kind: 'explainer',
    visual: {
      scenes: [
        { chart: 'fed-pv', alt: 'Paired bars showing the same future payments worth less today at a 5 percent rate than at 3 percent.', from: 'head' },
        { chart: 'fed-day', alt: 'A rising savings line that dips on the day of a Fed press conference, though nothing about the plan changed.', from: 'body:1' },
        { chart: 'fed-duration', alt: 'Two bars: a payment in year 3 loses about 3 percent of its value when rates rise one point, one in year 20 loses about 18 percent.', from: 'callout' },
      ],
    },
  },
  {
    id: 'data-center-bills',
    tag: 'SIGNALS',
    headline: 'Who Really Pays for Data Centers',
    dek: "AI's hunger for power is showing up on local electric bills.",
    readTime: '5 MIN',
    byline: ['PROTO LABS DESK', 'INFRASTRUCTURE'],
    body: [
      'Training and running large AI models takes a lot of continuous electricity, and a single large data center campus can draw as much power as a small city. Utilities have to build the substations, transmission lines, and generation capacity to serve that load — and in several regulatory structures, some share of that buildout cost is spread across the general pool of ratepayers, not billed solely to the data center operator.',
      "That arrangement made sense when a new large customer was a factory that employed thousands of local residents. It's drawing more scrutiny now that the new large customer is a server farm with a comparatively small on-site staff, negotiating its own discounted industrial rate while the infrastructure cost gets socialized.",
      "The resistance isn't really anti-AI. It's a pricing dispute: who benefits from the buildout, and who's listed as the payer on the bill. A handful of state regulators have begun opening separate rate classes for large data-center loads specifically to settle that question before it becomes a political one.",
    ],
    callout: {
      k: 'TERM TO KNOW',
      text: "'Load growth' — the industry phrase for new demand straining the grid. It used to mean population growth. Now it increasingly means server racks.",
    },
    kind: 'explainer',
    visual: {
      aspect: '1376 / 768',
      note: 'ILLUSTRATIVE IMAGES · NOT FROM A SPECIFIC EVENT · NO LIVE DATA',
      scenes: [
        { src: '/signal-visuals/data-centers.webp', alt: 'An illustration: a data center campus, transmission lines, a substation, and a home with its meter and bill.', from: 'head' },
        { src: '/signal-visuals/dc-aerial.webp', alt: 'An aerial view of two large data center buildings on flat farmland, with roads, ponds and a parking lot.', from: 'body:0', pos: '50% 55%' },
        { src: '/signal-visuals/dc-aisle.webp', alt: 'A long aisle of server racks with blue lights and no people in it.', from: 'body:1' },
        { src: '/signal-visuals/dc-people.webp', alt: 'Two people smiling on a city street as one hands the other some papers.', from: 'body:2', pos: '50% 30%' },
        { src: '/signal-visuals/data-centers.webp', alt: 'The illustration again: campus, transmission lines, substation, and a home with its bill.', from: 'callout' },
      ],
    },
  },
  {
    id: 'earnings-brief',
    tag: 'LIVE FORMAT',
    live: true,
    headline: 'The 90-Second Earnings Brief',
    dek: "Three numbers from today's calls, stripped of the spin.",
    readTime: '2 MIN',
    byline: ['PROTO LABS DESK', 'RECURRING COLUMN · SAMPLE ISSUE'],
    body: [
      'Every earnings season produces thousands of pages of transcripts and exactly a handful of numbers that matter. This recurring column distills three calls a day into the sentence a careful reader would underline — no sentiment, no spin, just the figure and why it moved.',
    ],
    brief: [
      {
        num: '01 · CLOUD INFRASTRUCTURE',
        h: 'Guidance quietly tightened',
        p: "A major cloud provider kept headline revenue growth steady but narrowed next-quarter guidance by two points, pointing to 'measured enterprise AI spend' — a softer phrase for customers pausing before the next contract cycle.",
      },
      {
        num: '02 · REGIONAL RETAIL',
        h: "Margin held, traffic didn't",
        p: 'Same-store sales fell for a second straight quarter at a mid-size retail chain, but gross margin actually improved — a sign the company is managing profitability by cutting promotions rather than by selling more.',
      },
      {
        num: '03 · INDUSTRIAL SUPPLY',
        h: 'Backlog is the real headline',
        p: 'Revenue missed estimates at an industrial parts supplier, but order backlog grew double digits — the kind of mismatch that often means delayed shipping, not falling demand.',
      },
    ],
    kind: 'sample',
    visual: {
      scenes: [
        { chart: 'earn-intro', alt: 'Three tiles: cloud infrastructure, regional retail and industrial supply, each with its one-line finding.', from: 'head' },
        { chart: 'earn-cloud', alt: 'Two bars, original and updated guidance, with the updated one two points lower.', from: 'brief:0' },
        { chart: 'earn-retail', alt: 'Same-store sales bars falling for a second quarter while gross margin bars rise.', from: 'brief:1' },
        { chart: 'earn-industrial', alt: 'Revenue bar short of the estimate line, next to an order backlog bar that has grown by double digits.', from: 'brief:2' },
      ],
    },
  },
  {
    id: 'supply-chain-watch',
    tag: 'TRACKER',
    headline: 'Supply Chain Watch',
    dek: 'Three choke points worth watching this week.',
    readTime: '2 MIN',
    byline: ['PROTO LABS DESK', 'RECURRING TRACKER · SAMPLE ISSUE'],
    body: [
      "A running tracker of the chokepoints that tend to show up two quarters later as margin surprises. Status reflects direction of travel, not severity — 'elevated' means getting worse, 'easing' means getting better, 'stable' means holding.",
    ],
    ticker: [
      {
        status: 'elevated',
        h: 'Pacific port dwell times',
        p: 'Container dwell time at major West Coast terminals has crept past seasonal norms for three straight weeks.',
      },
      {
        status: 'stable',
        h: 'Semiconductor lead times',
        p: "Lead times for mature-node chips have held flat after last year's volatility — the category to watch is leading-edge capacity, not legacy.",
      },
      {
        status: 'easing',
        h: 'Ocean freight spot rates',
        p: 'Spot rates on major trans-Pacific lanes have drifted down from their peak, typically a leading signal for softer retail restocking ahead.',
      },
    ],
    kind: 'sample',
    visual: {
      scenes: [
        { chart: 'sc-legend', alt: 'Three status tiles: elevated means getting worse, stable means holding, easing means getting better.', from: 'head' },
        { chart: 'sc-ports', alt: 'A line of port dwell times that has risen above the seasonal norm band for the last three weeks.', from: 'ticker:0' },
        { chart: 'sc-chips', alt: 'A flat line for mature-node chip lead times, and a note to watch leading-edge capacity.', from: 'ticker:1' },
        { chart: 'sc-freight', alt: 'A line of ocean freight spot rates drifting down from an earlier peak.', from: 'ticker:2' },
      ],
    },
  },
  {
    id: 'filing-nobody-read',
    tag: 'FILINGS',
    headline: 'The Filing Nobody Read',
    dek: 'One paragraph, buried on page 47, that changes the whole picture.',
    readTime: '4 MIN',
    byline: ['PROTO LABS DESK', 'REGULATORY DEEP DIVE'],
    body: [
      "Annual reports are long by design — not to hide anything illegally, but because disclosure law rewards completeness over clarity. The headline numbers sit on page three. The sentence that actually explains the company's risk usually sits forty pages later, in a section called 'Risk Factors' that almost nobody outside a law firm reads in full.",
      'A recurring example worth knowing how to spot: customer concentration. A company can post record revenue while quietly disclosing that one customer now accounts for a quarter of sales. That single sentence is worth more than the entire earnings press release, because it tells you how fragile the growth actually is — one lost contract away from a very different year.',
      "Reading a filing well isn't about reading all of it. It's about knowing which three sections carry the information management would rather you skim past: risk factors, related-party transactions, and the footnotes to the revenue line. Everything else is mostly restating what the press release already said.",
    ],
    callout: {
      k: 'WHERE TO LOOK',
      text: "Search any filing for the phrase 'substantially all' — it's the most common hedge word for a concentration risk the company would rather not spell out in plain numbers.",
    },
    kind: 'explainer',
  },
];

export function findDispatch(id: string): Dispatch | undefined {
  return DISPATCHES.find((d) => d.id === id);
}
