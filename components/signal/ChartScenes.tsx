import type { ReactNode } from 'react';
import styles from './signal.module.css';

// Scenes for the data dispatches, drawn in code so they stay sharp at any size
// and match the words they illustrate. They are schematic: no market data. The
// only numbers are plain arithmetic (present value) or figures already in the
// dispatch text, and every scene says ILLUSTRATIVE in the corner.

const TEAL = '#3fd0c9';
const AMBER = '#e3a53e';
const FAINT = '#5c6e7f';
const DIM = '#8fa1b3';
const FG = '#e9eef3';
const GRID = 'rgba(233,238,243,0.12)';
const BASE = 330;

function Frame({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 893 396" className={styles.chartSvg} aria-hidden="true">
      <defs>
        <linearGradient id="ch-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1320" />
          <stop offset="1" stopColor="#05090f" />
        </linearGradient>
      </defs>
      <rect width="893" height="396" fill="url(#ch-bg)" />
      <text x="40" y="54" className={styles.chTitle}>
        {title}
      </text>
      {sub && (
        <text x="40" y="78" className={styles.chSub}>
          {sub}
        </text>
      )}
      <line x1="40" x2="853" y1={BASE} y2={BASE} stroke={GRID} />
      {children}
      <text x="853" y="378" textAnchor="end" className={styles.chLabel} fill={FAINT}>
        ILLUSTRATIVE · NOT MARKET DATA
      </text>
    </svg>
  );
}

const Bar = ({ x, w, h, fill, delay = 0 }: { x: number; w: number; h: number; fill: string; delay?: number }) => (
  <rect className={styles.chBar} x={x} y={BASE - h} width={w} height={h} rx="3" fill={fill} style={{ animationDelay: `${delay}s` }} />
);

const Line = ({ d, stroke, dash }: { d: string; stroke: string; dash?: string }) => (
  <path className={styles.chLine} d={d} fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={dash} />
);

const Chip = ({ x, y, text, color, center }: { x: number; y: number; text: string; color: string; center?: boolean }) => {
  const w = text.length * 9.4 + 22;
  const left = center ? x - w / 2 : x;
  return (
  <g>
    <rect x={left} y={y} width={w} height="26" rx="4" fill="none" stroke={color} strokeOpacity="0.7" />
    <text x={left + 11} y={y + 17.5} className={styles.chLabel} fill={color}>
      {text}
    </text>
  </g>
  );
};

const Note = ({ x, y, lines, anchor = 'start' }: { x: number; y: number; lines: string[]; anchor?: 'start' | 'middle' }) => (
  <text className={styles.chNote} textAnchor={anchor}>
    {lines.map((l, i) => (
      <tspan key={l} x={x} y={y + i * 21}>
        {l}
      </tspan>
    ))}
  </text>
);

/* ---------- The 90-Second Earnings Brief ---------- */

function EarnIntro() {
  const tiles = [
    { n: '01', k: 'CLOUD INFRASTRUCTURE', h: 'Guidance quietly tightened' },
    { n: '02', k: 'REGIONAL RETAIL', h: "Margin held, traffic didn't" },
    { n: '03', k: 'INDUSTRIAL SUPPLY', h: 'Backlog is the real headline' },
  ];
  return (
    <Frame title="THE 90-SECOND EARNINGS BRIEF" sub="THREE NUMBERS FROM TODAY'S CALLS, STRIPPED OF THE SPIN">
      {tiles.map((t, i) => (
        <g key={t.n} transform={`translate(${40 + i * 280} 112)`}>
          <rect width="253" height="206" rx="6" fill="rgba(233,238,243,0.04)" stroke={GRID} />
          <text x="20" y="64" className={styles.chBig} fill={TEAL}>
            {t.n}
          </text>
          <text x="20" y="104" className={styles.chLabel} fill={DIM}>
            {t.k}
          </text>
          <text x="20" y="150" className={styles.chNote} fill={FG}>
            {t.h}
          </text>
        </g>
      ))}
    </Frame>
  );
}

function EarnCloud() {
  return (
    <Frame title="CLOUD INFRASTRUCTURE" sub="NEXT-QUARTER GUIDANCE · NARROWED BY TWO POINTS">
      <Bar x={230} w={130} h={200} fill="rgba(143,161,179,0.55)" />
      <Bar x={420} w={130} h={176} fill={TEAL} delay={0.25} />
      <line x1="230" x2="550" y1={BASE - 200} y2={BASE - 200} stroke={AMBER} strokeDasharray="5 5" strokeOpacity="0.8" />
      <path d={`M485 ${BASE - 198} v18 m-8 -8 l8 10 l8 -10`} stroke={AMBER} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="295" y="352" textAnchor="middle" className={styles.chLabel} fill={DIM}>
        ORIGINAL
      </text>
      <text x="485" y="352" textAnchor="middle" className={styles.chLabel} fill={DIM}>
        UPDATED
      </text>
      <text x="590" y={BASE - 168} className={styles.chBig} fill={AMBER}>
        −2 pts
      </text>
      <Note x={590} y={BASE - 132} lines={['Headline growth steady.', 'Guidance narrowed.']} />
    </Frame>
  );
}

function EarnRetail() {
  return (
    <Frame title="REGIONAL RETAIL" sub="MARGIN HELD, TRAFFIC DIDN'T">
      <text x="200" y="122" textAnchor="middle" className={styles.chLabel} fill={DIM}>
        SAME-STORE SALES
      </text>
      <Bar x={120} w={80} h={140} fill="rgba(143,161,179,0.55)" />
      <Bar x={215} w={80} h={104} fill="#c9645a" delay={0.25} />
      <text x="208" y="352" textAnchor="middle" className={styles.chLabel} fill={DIM}>
        PRIOR · THIS QUARTER
      </text>
      <Chip x={208} y={134} center text="DOWN, 2ND QUARTER RUNNING" color="#c9645a" />
      <text x="650" y="122" textAnchor="middle" className={styles.chLabel} fill={DIM}>
        GROSS MARGIN
      </text>
      <Bar x={570} w={80} h={100} fill="rgba(143,161,179,0.55)" />
      <Bar x={665} w={80} h={140} fill={TEAL} delay={0.25} />
      <text x="658" y="352" textAnchor="middle" className={styles.chLabel} fill={DIM}>
        PRIOR · THIS QUARTER
      </text>
      <Chip x={658} y={134} center text="IMPROVED" color={TEAL} />
    </Frame>
  );
}

function EarnIndustrial() {
  return (
    <Frame title="INDUSTRIAL SUPPLY" sub="BACKLOG IS THE REAL HEADLINE">
      <text x="200" y="122" textAnchor="middle" className={styles.chLabel} fill={DIM}>
        REVENUE VS. ESTIMATE
      </text>
      <Bar x={140} w={120} h={112} fill="#c9645a" />
      <line x1="110" x2="290" y1={BASE - 140} y2={BASE - 140} stroke={AMBER} strokeDasharray="5 5" />
      <text x="290" y={BASE - 148} textAnchor="end" className={styles.chLabel} fill={AMBER}>
        ESTIMATE
      </text>
      <Chip x={200} y={134} center text="MISSED" color="#c9645a" />
      <text x="650" y="122" textAnchor="middle" className={styles.chLabel} fill={DIM}>
        ORDER BACKLOG
      </text>
      <Bar x={570} w={80} h={96} fill="rgba(143,161,179,0.55)" />
      <Bar x={665} w={80} h={142} fill={TEAL} delay={0.25} />
      <Chip x={658} y={134} center text="UP DOUBLE DIGITS" color={TEAL} />
    </Frame>
  );
}

/* ---------- Supply Chain Watch ---------- */

function ScLegend() {
  const items = [
    { s: 'ELEVATED', d: 'getting worse', c: AMBER, path: 'M0 40 L40 28 L80 34 L120 8' },
    { s: 'STABLE', d: 'holding', c: TEAL, path: 'M0 24 L40 22 L80 26 L120 23' },
    { s: 'EASING', d: 'getting better', c: DIM, path: 'M0 8 L40 20 L80 14 L120 40' },
  ];
  return (
    <Frame title="SUPPLY CHAIN WATCH" sub="STATUS IS DIRECTION OF TRAVEL, NOT SEVERITY">
      {items.map((it, i) => (
        <g key={it.s} transform={`translate(${40 + i * 280} 118)`}>
          <rect width="253" height="196" rx="6" fill="rgba(233,238,243,0.04)" stroke={GRID} />
          <circle cx="28" cy="38" r="7" fill={it.c} />
          <text x="46" y="45" className={styles.chBig} fill={it.c} style={{ fontSize: 30 }}>
            {it.s}
          </text>
          <text x="20" y="88" className={styles.chNote} fill={FG}>
            {it.d}
          </text>
          <g transform="translate(20 112)">
            <Line d={it.path} stroke={it.c} />
          </g>
        </g>
      ))}
    </Frame>
  );
}

function ScPorts() {
  const pts = [150, 146, 152, 148, 151, 147, 149, 128, 108, 88];
  const xs = pts.map((_, i) => 80 + i * 78);
  const d = pts.map((y, i) => `${i ? 'L' : 'M'}${xs[i]} ${y + 80}`).join(' ');
  return (
    <Frame title="PACIFIC PORT DWELL TIMES" sub="CONTAINER DWELL TIME AT MAJOR WEST COAST TERMINALS">
      <rect x="60" y="198" width="760" height="46" fill={TEAL} opacity="0.1" />
      <text x="66" y="192" className={styles.chLabel} fill={DIM}>
        SEASONAL NORM
      </text>
      <Line d={d} stroke={AMBER} />
      <path d={`M${xs[7] - 12} 254 v10 h${xs[9] - xs[7] + 24} v-10`} stroke={AMBER} strokeWidth="2" fill="none" />
      <text x={(xs[7] + xs[9]) / 2} y="286" textAnchor="middle" className={styles.chLabel} fill={AMBER}>
        3 WEEKS ABOVE NORM
      </text>
      <Chip x={720} y={100} text="ELEVATED" color={AMBER} />
    </Frame>
  );
}

function ScChips() {
  return (
    <Frame title="SEMICONDUCTOR LEAD TIMES" sub="MATURE-NODE CHIPS HAVE HELD FLAT">
      <Line d="M70 190 L180 186 L290 192 L400 188 L510 191 L620 187 L730 190 L840 188" stroke={TEAL} />
      <text x="70" y="168" className={styles.chLabel} fill={DIM}>
        MATURE NODES: FLAT AFTER LAST YEAR&apos;S VOLATILITY
      </text>
      <rect x="470" y="236" width="380" height="64" rx="6" fill="none" stroke={AMBER} strokeOpacity="0.6" strokeDasharray="5 5" />
      <text x="488" y="262" className={styles.chLabel} fill={AMBER}>
        THE CATEGORY TO WATCH
      </text>
      <text x="488" y="284" className={styles.chNote} fill={FG}>
        leading-edge capacity, not legacy
      </text>
      <Chip x={720} y={100} text="STABLE" color={TEAL} />
    </Frame>
  );
}

function ScFreight() {
  return (
    <Frame title="OCEAN FREIGHT SPOT RATES" sub="MAJOR TRANS-PACIFIC LANES">
      <Line d="M70 120 C150 110 200 128 270 168 S420 226 520 246 S720 266 840 272" stroke={DIM} />
      <circle cx="70" cy="120" r="6" fill={AMBER} />
      <text x="86" y="112" className={styles.chLabel} fill={AMBER}>
        PEAK
      </text>
      <Chip x={720} y={100} text="EASING" color={DIM} />
      <Note x={70} y={324} lines={['Typically a leading signal for softer retail restocking ahead.']} />
    </Frame>
  );
}

/* ---------- Your 401(k) vs. The Fed ---------- */

const pv = (rate: number, years: number) => 100 / Math.pow(1 + rate, years);
const drop = (years: number) => (1 - Math.pow(1.03 / 1.04, years)) * 100; // value lost when the rate moves 3% to 4%

function FedPv() {
  return (
    <Frame title="YOUR 401(K) VS. THE FED" sub="THE SAME PAYMENTS ARE WORTH LESS TODAY WHEN RATES RISE">
      {Array.from({ length: 10 }, (_, i) => {
        const t = i + 1;
        const x = 60 + i * 78;
        return (
          <g key={t}>
            <Bar x={x} w={24} h={pv(0.03, t) * 1.85} fill={TEAL} delay={i * 0.04} />
            <Bar x={x + 28} w={24} h={pv(0.05, t) * 1.85} fill={AMBER} delay={i * 0.04 + 0.1} />
            <text x={x + 26} y="350" textAnchor="middle" className={styles.chLabel} fill={DIM}>
              {t}
            </text>
          </g>
        );
      })}
      <text x="60" y="108" className={styles.chLabel} fill={TEAL}>
        ■ RATES AT 3%
      </text>
      <text x="190" y="108" className={styles.chLabel} fill={AMBER}>
        ■ RATES AT 5%
      </text>
      <text x="853" y="118" textAnchor="end" className={styles.chNote} fill={FG}>
        $100 paid in year 10 is worth ${Math.round(pv(0.03, 10))} today at 3%,
      </text>
      <text x="853" y="139" textAnchor="end" className={styles.chNote} fill={FG}>
        and ${Math.round(pv(0.05, 10))} at 5%.
      </text>
      <text x="450" y="378" textAnchor="middle" className={styles.chLabel} fill={DIM}>
        YEARS UNTIL THE PAYMENT
      </text>
    </Frame>
  );
}

function FedDay() {
  return (
    <Frame title="A BAD DAY YOU DIDN'T CAUSE" sub="YOUR BALANCE CAN MOVE ON A DAY YOU DID NOTHING">
      <Line d="M60 270 L150 256 L240 262 L330 236 L420 228 L500 214 L520 214 L534 262 L620 250 L720 224 L853 196" stroke={TEAL} />
      <line x1="520" x2="520" y1="100" y2={BASE} stroke={AMBER} strokeDasharray="5 5" />
      <text x="530" y="116" className={styles.chLabel} fill={AMBER}>
        FED PRESS CONFERENCE
      </text>
      <text x="60" y="318" className={styles.chLabel} fill={DIM}>
        SAME SAVING, SAME PLAN
      </text>
      <Note x={546} y={296} lines={['The number on the statement moves.', 'The plan did not change.']} />
    </Frame>
  );
}

function FedDuration() {
  const near = drop(3);
  const far = drop(20);
  return (
    <Frame title="WHO FEELS A RATE RISE MOST" sub="VALUE LOST WHEN THE RATE MOVES FROM 3% TO 4%">
      <Bar x={180} w={150} h={near * 10.5} fill={TEAL} />
      <Bar x={470} w={150} h={far * 10.5} fill={AMBER} delay={0.25} />
      <text x="255" y={BASE - near * 10.5 - 12} textAnchor="middle" className={styles.chBig} fill={TEAL} style={{ fontSize: 32 }}>
        −{near.toFixed(1)}%
      </text>
      <text x="545" y={BASE - far * 10.5 - 12} textAnchor="middle" className={styles.chBig} fill={AMBER} style={{ fontSize: 32 }}>
        −{far.toFixed(1)}%
      </text>
      <text x="255" y="352" textAnchor="middle" className={styles.chLabel} fill={DIM}>
        PAID IN YEAR 3
      </text>
      <text x="545" y="352" textAnchor="middle" className={styles.chLabel} fill={DIM}>
        PAID IN YEAR 20
      </text>
      <Note x={660} y={170} lines={['Growth stocks, whose', 'cash flows sit furthest', 'out, feel it most.']} />
    </Frame>
  );
}

/* ---------- The Filing Nobody Read ---------- */

const Page = ({ x, y, n, tone }: { x: number; y: number; n: number; tone?: 'teal' | 'amber' }) => {
  const c = tone === 'teal' ? TEAL : tone === 'amber' ? AMBER : FAINT;
  return (
    <g>
      <rect x={x} y={y} width="52" height="78" rx="3" fill={tone ? 'rgba(233,238,243,0.08)' : 'rgba(233,238,243,0.04)'} stroke={tone ? c : GRID} strokeWidth={tone ? 2 : 1} />
      {[14, 26, 38, 50].map((dy) => (
        <line key={dy} x1={x + 8} x2={x + 44} y1={y + dy} y2={y + dy} stroke={c} strokeOpacity={tone ? 0.7 : 0.35} strokeWidth="2.5" strokeLinecap="round" />
      ))}
      {tone === 'amber' && <rect x={x + 6} y={y + 33} width="40" height="10" rx="2" fill={AMBER} opacity="0.55" />}
      <text x={x + 26} y={y + 98} textAnchor="middle" className={styles.chLabel} fill={tone ? c : DIM}>
        {n}
      </text>
    </g>
  );
};

function FilingPages() {
  const first = [1, 2, 3, 4, 5];
  const later = [45, 46, 47, 48, 49];
  return (
    <Frame title="THE FILING NOBODY READ" sub="ONE PARAGRAPH, BURIED ON PAGE 47">
      {first.map((n, i) => (
        <Page key={n} x={50 + i * 64} y={130} n={n} tone={n === 3 ? 'teal' : undefined} />
      ))}
      {later.map((n, i) => (
        <Page key={n} x={500 + i * 64} y={130} n={n} tone={n === 47 ? 'amber' : undefined} />
      ))}
      <text x="436" y="178" textAnchor="middle" className={styles.chBig} fill={FAINT}>
        ···
      </text>
      <text x={50 + 2 * 64 + 26} y="262" textAnchor="middle" className={styles.chLabel} fill={TEAL}>
        HEADLINE NUMBERS
      </text>
      <text x={500 + 2 * 64 + 26} y="262" textAnchor="middle" className={styles.chLabel} fill={AMBER}>
        RISK FACTORS
      </text>
      <path d="M180 112 v-10 h300 v10" stroke={DIM} strokeWidth="1.5" fill="none" />
      <text x="330" y="94" textAnchor="middle" className={styles.chLabel} fill={DIM}>
        FORTY PAGES LATER
      </text>
      <Note x={50} y={316} lines={['The sentence that explains the risk sits where almost nobody reads.']} />
    </Frame>
  );
}

function FilingConcentration() {
  const x0 = 60;
  const w = 773;
  const q = w / 4;
  return (
    <Frame title="CUSTOMER CONCENTRATION" sub="RECORD REVENUE, AND ONE QUIET SENTENCE">
      <Chip x={60} y={104} text="RECORD REVENUE" color={TEAL} />
      <rect className={styles.chBar} x={x0} y={156} width={w - q} height="64" rx="4" fill="rgba(143,161,179,0.45)" />
      <rect className={styles.chBar} x={x0 + w - q} y={156} width={q} height="64" rx="4" fill={AMBER} style={{ animationDelay: '0.3s' }} />
      <text x={x0 + (w - q) / 2} y={194} textAnchor="middle" className={styles.chLabel} fill={FG}>
        EVERYONE ELSE
      </text>
      <text x={x0 + w - q / 2} y={188} textAnchor="middle" className={styles.chLabel} fill="#1a1204">
        ONE CUSTOMER
      </text>
      <text x={x0 + w - q / 2} y={204} textAnchor="middle" className={styles.chLabel} fill="#1a1204">
        A QUARTER OF SALES
      </text>
      <rect x={x0} y={256} width={w - q} height="40" rx="4" fill="rgba(143,161,179,0.45)" />
      <rect x={x0 + w - q} y={256} width={q} height="40" rx="4" fill="none" stroke={AMBER} strokeDasharray="6 5" />
      <text x={x0 + w - q / 2} y={281} textAnchor="middle" className={styles.chLabel} fill={AMBER}>
        IF THAT CONTRACT GOES
      </text>
      <Note x={60} y={334} lines={['One lost contract away from a very different year.']} />
    </Frame>
  );
}

function FilingSections() {
  const tiles = [
    { n: '1', k: ['RISK FACTORS'] },
    { n: '2', k: ['RELATED-PARTY', 'TRANSACTIONS'] },
    { n: '3', k: ['FOOTNOTES TO THE', 'REVENUE LINE'] },
  ];
  return (
    <Frame title="READ THREE SECTIONS, NOT ALL OF IT" sub="WHAT MANAGEMENT WOULD RATHER YOU SKIM PAST">
      {tiles.map((t, i) => (
        <g key={t.n} transform={`translate(${40 + i * 280} 108)`}>
          <rect width="253" height="150" rx="6" fill="rgba(233,238,243,0.04)" stroke={AMBER} strokeOpacity="0.5" />
          <text x="20" y="62" className={styles.chBig} fill={AMBER}>
            {t.n}
          </text>
          {t.k.map((line, j) => (
            <text key={line} x="20" y={98 + j * 18} className={styles.chLabel} fill={FG}>
              {line}
            </text>
          ))}
        </g>
      ))}
      <rect x="40" y="282" width="813" height="34" rx="4" fill="none" stroke={GRID} strokeDasharray="5 5" />
      <text x="446" y="304" textAnchor="middle" className={styles.chLabel} fill={DIM}>
        EVERYTHING ELSE: MOSTLY RESTATES THE PRESS RELEASE
      </text>
    </Frame>
  );
}

function FilingSearch() {
  return (
    <Frame title="WHERE TO LOOK" sub="THE MOST COMMON HEDGE WORD FOR A CONCENTRATION RISK">
      <rect x="120" y="112" width="653" height="56" rx="8" fill="rgba(233,238,243,0.05)" stroke={TEAL} strokeOpacity="0.7" />
      <circle cx="152" cy="138" r="9" fill="none" stroke={TEAL} strokeWidth="2.5" />
      <path d="M159 145 l9 9" stroke={TEAL} strokeWidth="2.5" strokeLinecap="round" />
      <text x="186" y="147" className={styles.chLabel} fill={FG} style={{ fontSize: 22, letterSpacing: '0.06em' }}>
        substantially all
      </text>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="120" y={204 + i * 24} width={i === 2 ? 300 : 520 - i * 40} height="9" rx="4" fill="rgba(143,161,179,0.3)" />
      ))}
      <rect x="440" y="252" width="150" height="14" rx="3" fill={AMBER} opacity="0.75" />
      <text x="606" y="263" className={styles.chLabel} fill={AMBER}>
        ← THE HEDGE
      </text>
      <Note x={120} y={332} lines={['The company would rather not spell it out in plain numbers.']} />
    </Frame>
  );
}

export const CHARTS: Record<string, () => ReactNode> = {
  'earn-intro': EarnIntro,
  'earn-cloud': EarnCloud,
  'earn-retail': EarnRetail,
  'earn-industrial': EarnIndustrial,
  'sc-legend': ScLegend,
  'sc-ports': ScPorts,
  'sc-chips': ScChips,
  'sc-freight': ScFreight,
  'fed-pv': FedPv,
  'fed-day': FedDay,
  'fed-duration': FedDuration,
  'filing-pages': FilingPages,
  'filing-concentration': FilingConcentration,
  'filing-sections': FilingSections,
  'filing-search': FilingSearch,
};
