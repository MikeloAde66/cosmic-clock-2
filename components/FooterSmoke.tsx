// A few faint wisps of smoke that now and then drift up from behind the hub
// footer: "something's cooking". Pure CSS, decorative, and off entirely for
// anyone who prefers reduced motion. The warp filter lives on the still inner
// layer so the browser draws it once and only moves the finished picture.

const WISPS = [
  { left: '6%', w: 300, dur: 23, delay: 2, drift: 70, peak: 0.14 },
  { left: '19%', w: 220, dur: 31, delay: 11, drift: -50, peak: 0.11 },
  { left: '33%', w: 340, dur: 27, delay: 6, drift: 40, peak: 0.125 },
  { left: '48%', w: 260, dur: 36, delay: 19, drift: -80, peak: 0.1 },
  { left: '62%', w: 320, dur: 25, delay: 14, drift: 60, peak: 0.14 },
  { left: '76%', w: 230, dur: 33, delay: 4, drift: -40, peak: 0.11 },
  { left: '88%', w: 280, dur: 29, delay: 23, drift: -60, peak: 0.125 },
];

export default function FooterSmoke() {
  return (
    <div aria-hidden="true" className="footer-smoke absolute inset-x-0 bottom-[-34px] h-[170px] overflow-hidden pointer-events-none">
      <svg width="0" height="0" className="absolute">
        <filter id="smoke-warp" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.02" numOctaves="3" seed="8" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="70" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </svg>
      {WISPS.map((w, i) => (
        <span
          key={i}
          className={`footer-smoke-wisp${i > 3 ? ' max-sm:hidden' : ''}`}
          style={{
            left: w.left,
            width: w.w,
            height: w.w * 0.55,
            ['--dur' as string]: `${w.dur}s`,
            ['--delay' as string]: `${w.delay}s`,
            ['--drift' as string]: `${w.drift}px`,
            ['--peak' as string]: w.peak,
          }}
        >
          <i />
        </span>
      ))}
    </div>
  );
}
