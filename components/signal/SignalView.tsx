'use client';

import Link from 'next/link';
import { useMemo, useSyncExternalStore } from 'react';
import { DISPATCHES, findDispatch } from '@/lib/signal/dispatches';
import type { Dispatch } from '@/lib/signal/dispatches';
import { dispatchScript, issueScript } from '@/lib/signal/speech';
import { signalBody, signalDisplay, signalMono } from './fonts';
import ListenBar from './ListenBar';
import styles from './signal.module.css';

// Signal, the digital magazine. A grid of dispatches that swaps, through a
// bare #hash, into a full-width reader. It is a design preview: the pieces are
// evergreen explainers and two sample formats, and the page says so.

const HOME_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9.5h13V10" />
  </svg>
);

const subscribeHash = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  window.addEventListener('popstate', cb);
  return () => {
    window.removeEventListener('hashchange', cb);
    window.removeEventListener('popstate', cb);
  };
};
const snapshotHash = () => window.location.hash.replace('#', '');
const serverHash = () => '';

function goHome() {
  try {
    window.history.pushState(null, '', window.location.pathname + window.location.search);
    window.dispatchEvent(new PopStateEvent('popstate'));
  } catch {
    window.location.hash = '';
  }
  window.scrollTo(0, 0);
}

function openDispatch(id: string) {
  window.location.hash = id;
  window.scrollTo(0, 0);
}

function KindLabel({ kind }: { kind: Dispatch['kind'] }) {
  return kind === 'sample' ? (
    <span className={`${styles.cardKind} ${styles.cardKindSample}`}>SAMPLE · ILLUSTRATIVE FIGURES</span>
  ) : (
    <span className={styles.cardKind}>EXPLAINER · NO LIVE DATA</span>
  );
}

function Reader({ d }: { d: Dispatch }) {
  const sample = d.kind === 'sample';
  const script = useMemo(() => dispatchScript(d), [d]);
  return (
    <div className={styles.article}>
      <div className={styles.artTagRow}>
        <span className={`${styles.tag} ${d.live ? styles.tagLive : ''}`}>{d.tag}</span>
        <span className={styles.readTime}>{d.readTime}</span>
      </div>
      <h1 className={styles.artTitle}>{d.headline}</h1>
      <p className={styles.artDek}>{d.dek}</p>
      <div className={styles.byline}>
        {d.byline.map((b) => (
          <span key={b}>{b}</span>
        ))}
      </div>
      <p className={`${styles.kindNote} ${sample ? styles.kindNoteSample : ''}`}>
        {sample ? (
          <>
            <b>SAMPLE</b>
            The companies and figures below are illustrative, written to show the format. They are not real reporting.
          </>
        ) : (
          <>
            <b>EXPLAINER</b>
            General background, written without live data or cited sources. Not a news report.
          </>
        )}
      </p>
      <ListenBar id={d.id} chunks={script} label="LISTEN" />
      <div className={styles.artBody}>
        {d.body.map((p) => (
          <p key={p.slice(0, 40)}>{p}</p>
        ))}
      </div>
      {d.callout && (
        <div className={styles.callout}>
          <span className={styles.calloutK}>{d.callout.k}</span>
          <p>{d.callout.text}</p>
        </div>
      )}
      {d.brief && (
        <div className={styles.briefList}>
          {d.brief.map((b) => (
            <div key={b.num} className={styles.briefItem}>
              <div className={styles.briefNum}>{b.num}</div>
              <h3>{b.h}</h3>
              <p>{b.p}</p>
            </div>
          ))}
        </div>
      )}
      {d.ticker && (
        <div className={styles.ticker}>
          {d.ticker.map((t) => (
            <div key={t.h} className={styles.tickerRow}>
              <span className={`${styles.dot} ${t.status === 'elevated' ? styles.dotElevated : t.status === 'stable' ? styles.dotStable : styles.dotEasing}`} />
              <div className={styles.tickerMain}>
                <b>{t.h}</b>
                <span>{t.p}</span>
              </div>
              <span className={styles.tickerStatus}>{t.status}</span>
            </div>
          ))}
        </div>
      )}
      <div className={styles.artFoot}>
        <button type="button" className={styles.footHome} onClick={goHome}>
          {HOME_ICON}
          BACK TO SIGNAL
        </button>
        <span className={styles.footNote}>PROTO LABS DIGITAL</span>
      </div>
    </div>
  );
}

export default function SignalView() {
  const hash = useSyncExternalStore(subscribeHash, snapshotHash, serverHash);
  const open = hash ? findDispatch(hash) : undefined;
  const briefing = useMemo(() => issueScript(DISPATCHES), []);

  return (
    <div className={`${styles.root} ${signalDisplay.variable} ${signalBody.variable} ${signalMono.variable}`}>
      <div className={styles.app}>
        <div className={styles.topbar}>
          <div className={styles.brand}>
            <div className={styles.brandMark} aria-hidden="true" />
            <div className={styles.brandText}>
              <b>PROTO LABS</b>
              <span>DIGITAL MAGAZINE</span>
            </div>
          </div>
          {open ? (
            <button type="button" className={styles.homeBtn} onClick={goHome}>
              {HOME_ICON}
              HOME
            </button>
          ) : (
            <Link href="/" className={styles.siteLink}>
              AI ONE &rarr;
            </Link>
          )}
        </div>

        {open ? (
          <Reader d={open} />
        ) : (
          <div>
            <div className={styles.hero}>
              <div className={styles.eyebrow}>SIGNAL &amp; TRACKER EDITION</div>
              <h1 className={styles.masthead}>
                S<em>I</em>GNAL
              </h1>
              <p className={styles.sub}>The numbers behind the news — where the money actually moves, who actually pays, and what&apos;s buried on page 47.</p>
              <p className={styles.notice} role="note">
                <b>PREVIEW</b>
                <span>Signal is a design preview. The explainers are general background, not breaking news, and the sample dispatches use illustrative figures, not live data.</span>
              </p>
            </div>
            <div className={styles.briefingRow}>
              <ListenBar id="briefing" chunks={briefing} label="PLAY THE BRIEFING" />
            </div>
            <div className={styles.issueMeta}>SAMPLE ISSUE · {DISPATCHES.length} DISPATCHES · EVERGREEN EXPLAINERS, NOT LIVE NEWS</div>
            <div className={styles.grid}>
              {DISPATCHES.map((d) => (
                <button key={d.id} type="button" className={styles.card} onClick={() => openDispatch(d.id)}>
                  <div className={styles.cardTop}>
                    <span className={`${styles.tag} ${d.live ? styles.tagLive : ''}`}>{d.tag}</span>
                    <span className={styles.readTime}>{d.readTime}</span>
                  </div>
                  <h2>{d.headline}</h2>
                  <p>{d.dek}</p>
                  <KindLabel kind={d.kind} />
                  <div className={styles.cardFoot}>{d.byline.join(' · ')}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
