import styles from './signal.module.css';

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

// Placeholder icons and links; swap href and glyphs for the real accounts.
const SOCIALS = [
  { name: 'Instagram', icon: <><rect x="4" y="4" width="16" height="16" rx="4.5" {...P} /><circle cx="12" cy="12" r="3.6" {...P} /><circle cx="16.8" cy="7.2" r="0.6" fill="currentColor" /></> },
  { name: 'X', icon: <path d="M5 5l14 14M19 5L5 19" {...P} /> },
  { name: 'YouTube', icon: <><rect x="3" y="6" width="18" height="12" rx="3.5" {...P} /><path d="M10.5 9.5v5l4-2.5z" {...P} /></> },
  { name: 'TikTok', icon: <path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5M14 4c.4 2.3 1.9 3.6 4 3.8" {...P} /> },
  { name: 'Facebook', icon: <path d="M14 20v-7h2.5l.5-3H14V8.5c0-.9.4-1.5 1.6-1.5H17V4.3C16.6 4.2 15.8 4 14.9 4 12.7 4 11 5.3 11 8v2H8.5v3H11v7" {...P} /> },
  { name: 'LinkedIn', icon: <><path d="M6 10v8M6 6.5v.1M10 18v-8M10 13.5c0-2 1.3-3.5 3.2-3.5S16 11.300 16 13.5V18" {...P} /></> },
];

export default function SocialRow() {
  return (
    <nav className={styles.socialRow} aria-label="Social media">
      {SOCIALS.map((s) => (
        <a key={s.name} href="#" className={styles.socialBtn} aria-label={s.name}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">{s.icon}</svg>
        </a>
      ))}
    </nav>
  );
}
