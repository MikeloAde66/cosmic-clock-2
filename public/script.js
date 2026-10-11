// Protolabs Global — single-view shell
// No routing, no framework state — plain DOM wiring only, per spec.

// ---------- modular cover scene ----------
// The default scene's image + all cover copy live in coverConfig.json,
// not here — see loadCoverConfig() below. A monthly swap only ever
// touches that JSON file; nothing in this script or index.html changes.
//
// A scene is either:
//   - a real photo (`image` set) — shown clean, full-bleed, no procedural
//     effects layered on top of it; or
//   - a procedural backdrop (no `image`) — twinkling stars + a drifting
//     nebula gradient, useful for a month with no photo asset ready yet.
const COVER_SCENES = {
  default: {
    label: 'Cosmic Creator (populated from coverConfig.json at load)',
    image: null,
  },
  proceduralFallback: {
    label: 'Procedural nebula (no photo asset)',
    nebulaA: '#22d3ee',
    nebulaB: '#6366f1',
    nebulaC: '#0ea5e9',
    starCount: 140,
  },
};

const ACTIVE_SCENE = 'default';

function applyCoverScene(sceneId) {
  const scene = COVER_SCENES[sceneId] || COVER_SCENES.default;
  const sceneEl = document.getElementById('coverScene');
  const starfieldEl = document.getElementById('starfield');
  const nebulaEl = document.getElementById('nebulaLayer');
  const glowEl = document.getElementById('horizonGlow');
  sceneEl.dataset.scene = sceneId in COVER_SCENES ? sceneId : 'default';

  if (scene.image) {
    // Real photo, shown clean — no procedural effects layered on top of it.
    sceneEl.style.backgroundImage = `url('${scene.image}')`;
    starfieldEl.innerHTML = '';
    starfieldEl.style.display = 'none';
    nebulaEl.style.display = 'none';
    glowEl.style.display = 'none';
    return;
  }

  sceneEl.style.backgroundImage = 'none';
  starfieldEl.style.display = '';
  nebulaEl.style.display = '';
  glowEl.style.display = '';
  sceneEl.style.setProperty('--nebula-a', scene.nebulaA);
  sceneEl.style.setProperty('--nebula-b', scene.nebulaB);
  sceneEl.style.setProperty('--nebula-c', scene.nebulaC);

  starfieldEl.innerHTML = '';
  for (let i = 0; i < scene.starCount; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = (0.6 + Math.random() * 1.6).toFixed(2);
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${(Math.random() * 100).toFixed(2)}%`;
    star.style.top = `${(Math.random() * 100).toFixed(2)}%`;
    star.style.animationDuration = `${(2 + Math.random() * 4).toFixed(2)}s`;
    star.style.animationDelay = `${(Math.random() * 4).toFixed(2)}s`;
    starfieldEl.appendChild(star);
  }
}

// ---------- load cover config (image + copy) ----------
// The one file a monthly swap touches: backgroundImage, editionTag, and
// the four coverlines (title/sub/action). UI structure and behavior stay
// exactly as they are regardless of what's in here.
function renderCoverlines(coverlines) {
  const listEl = document.getElementById('coverlineList');
  listEl.innerHTML = '';
  coverlines.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'coverline';

    const a = document.createElement('a');
    if (item.action && item.action.type === 'link') {
      a.href = item.action.href;
      if (item.action.newTab) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    } else if (item.action && item.action.type === 'focus') {
      // Points at a real panel already on this page (Radio Central) —
      // scrolls to and highlights it instead of opening a demo modal
      // that would just describe something already in view.
      a.href = '#';
      a.dataset.focus = item.action.target;
    } else if (item.action && item.action.type === 'view') {
      // Flips to a full view-container (e.g. the Radio Central dashboard)
      // instead of a modal or an in-page scroll.
      a.href = '#';
      a.dataset.openView = item.action.target;
    } else if (item.action && item.action.type === 'audio') {
      // A standalone endpoint player, not a station or a view — see the
      // dedicated offGridAudio listener below. Deliberately never touches
      // radioAudio/Radio Central state, and never navigates anywhere.
      // javascript:void(0), not '#' — guarantees the address bar never
      // picks up a stray hash even in the (already-prevented) case where
      // the click listener somehow doesn't run.
      a.href = 'javascript:void(0)';
      a.dataset.audioSrc = item.action.src;
    } else {
      a.href = '#';
      a.dataset.overlay = item.action ? item.action.key : '';
    }

    const title = document.createElement('span');
    title.className = 'coverline-title';
    title.textContent = item.title;

    const sub = document.createElement('span');
    sub.className = 'coverline-sub';
    sub.textContent = item.sub;

    if (item.action && item.action.type === 'audio') {
      // Cover-art anchor for the one card that's a real player: a CSS-drawn
      // tile (no external image asset needed) that glows and shows a
      // "NOW PLAYING" badge while offGridAudio is actually playing — see
      // the play/pause listeners below.
      a.classList.add('coverline-audio-link');

      const titleRow = document.createElement('span');
      titleRow.className = 'coverline-title-row';

      const playIcon = document.createElement('span');
      playIcon.className = 'coverline-play-icon';
      playIcon.setAttribute('aria-hidden', 'true');
      playIcon.textContent = '▶';

      // Immediate, impossible-to-miss diagnostic badge — separate from the
      // cover-art glow (which only lights up once offGridAudio's own
      // 'play'/'pause' events fire, further below). This one is driven
      // directly by the click handler and any play() rejection, so it's
      // useful for telling "the click never registered" apart from
      // "the click fired but the browser blocked playback."
      const clickBadge = document.createElement('span');
      clickBadge.className = 'coverline-click-badge';

      titleRow.appendChild(title);
      titleRow.appendChild(playIcon);
      titleRow.appendChild(clickBadge);

      const textWrap = document.createElement('div');
      textWrap.className = 'coverline-text';
      textWrap.appendChild(titleRow);
      textWrap.appendChild(sub);

      const cover = document.createElement('div');
      cover.className = 'coverline-cover';
      cover.id = 'offGridCover';
      cover.setAttribute('aria-hidden', 'true');
      cover.textContent = '🎧';

      const coverBadge = document.createElement('span');
      coverBadge.className = 'coverline-cover-badge';
      coverBadge.textContent = 'NOW PLAYING';
      cover.appendChild(coverBadge);

      a.appendChild(textWrap);
      a.appendChild(cover);

      // Direct listener on this exact card — plays assets/audio/ai-off-
      // grid-and-diy-episode-1.mp3 via the native HTML5 Audio element
      // (offGridAudio, declared below) right here, no event delegation.
      const handleOffGridPlayError = (err) => {
        console.error('Autoplay error:', err);
        clickBadge.textContent = '[BLOCKED]';
        alert('Audio playback blocked by browser: ' + err.message);
      };

      a.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Playing Off Grid Audio');

        // Fires the instant the click is handled, regardless of whether
        // play() itself succeeds — proof the listener is actually bound.
        a.style.borderLeftColor = '#00f0ff';

        const src = item.action.src;
        if (!src) {
          clickBadge.textContent = '[UNAVAILABLE]';
          return;
        }
        if (offGridAudio.dataset.currentSrc === src) {
          if (offGridAudio.paused) {
            clickBadge.textContent = '[PLAYING]';
            offGridAudio.play().catch(handleOffGridPlayError);
          } else {
            offGridAudio.pause();
            clickBadge.textContent = '';
          }
          return;
        }
        offGridAudio.dataset.currentSrc = src;
        offGridAudio.src = src;
        // Avoid two audio sources overlapping — pausing the shared radio
        // here doesn't touch its displayed station, just its play state.
        if (radioPlaying) setRadioPlaying(false);
        clickBadge.textContent = '[PLAYING]';
        offGridAudio.play().catch(handleOffGridPlayError);
      });
    } else {
      a.appendChild(title);
      a.appendChild(sub);
    }
    li.appendChild(a);
    listEl.appendChild(li);
  });
}

// ---------- History Daily: dynamic episode feed for the "Ai, Off Grid and
// DIY" slot (both the coverline card above and the living-off-grid
// Playlist.tracks entry below) ----------
// Fetches /api/history-daily (a Vercel Serverless Function that fetches and
// parses the real RSS feed server-side). Never throws — every failure mode
// (network error, non-JSON body, ok:false, missing mp3Url) collapses to a
// single `null` return, so callers only ever need one branch.
async function fetchHistoryDailyEpisode() {
  try {
    const res = await fetch('/api/history-daily');
    const data = await res.json();
    if (!res.ok || data.ok === false || !data.mp3Url) return null;
    return data;
  } catch (err) {
    console.warn('History Daily episode fetch failed:', err);
    return null;
  }
}

// The first (and only) localStorage usage in this codebase — a small,
// deliberately-scoped cache of the last successfully-fetched episode, so a
// transient feed outage shows "last known good episode" instead of a bare
// "unavailable" state. Wrapped in try/catch since localStorage can throw in
// some private-browsing contexts; a cache miss there just means no cache.
const HISTORY_DAILY_CACHE_KEY = 'historyDailyEpisodeCache';

function saveHistoryDailyCache(episode) {
  try {
    localStorage.setItem(HISTORY_DAILY_CACHE_KEY, JSON.stringify(episode));
  } catch (err) {
    console.warn('Could not cache History Daily episode:', err);
  }
}

function loadHistoryDailyCache() {
  try {
    const raw = localStorage.getItem(HISTORY_DAILY_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    return cached && cached.mp3Url ? cached : null;
  } catch (err) {
    console.warn('Could not read cached History Daily episode:', err);
    return null;
  }
}

function truncateForSub(description) {
  const clean = (description || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length <= 160) return clean;
  return clean.slice(0, 160).trimEnd() + '…';
}

// The one function that patches both surfaces the old static "Ai, Off Grid
// and DIY" entry lived in (the coverline card + the Playlist.tracks row)
// and re-renders both. On a live-fetch failure, falls back to the last
// successfully-cached episode (still real, playable audio, just possibly
// not today's) before ever showing the honest "unavailable" state — never
// leaves the initial "Loading…" copy stuck forever either way.
function applyHistoryDailyEpisode(episode, coverlines) {
  const cl = coverlines.find((c) => c.action && c.action.podcastFeed);
  const track = Playlist.tracks.find((t) => t.id === 'living-off-grid');

  if (episode) {
    saveHistoryDailyCache(episode);
    if (cl) {
      cl.title = episode.title;
      cl.sub = truncateForSub(episode.description);
      cl.action.src = episode.mp3Url;
    }
    if (track) {
      track.title = episode.title;
      track.artist = 'History Daily';
      track.url = episode.mp3Url;
    }
  } else {
    const cached = loadHistoryDailyCache();
    if (cached) {
      if (cl) {
        cl.title = cached.title;
        cl.sub = '(Cached) ' + truncateForSub(cached.description);
        cl.action.src = cached.mp3Url;
      }
      if (track) {
        track.title = cached.title + ' (Cached)';
        track.artist = 'History Daily';
        track.url = cached.mp3Url;
      }
    } else {
      if (cl) {
        cl.sub = "Today's episode couldn't be loaded — try again shortly.";
      }
      if (track) {
        track.title = 'History Daily (unavailable)';
        track.url = null;
      }
    }
  }

  if (cl) renderCoverlines(coverlines);
  renderPlaylist();
}

async function loadCoverConfig() {
  try {
    const res = await fetch('coverConfig.json');
    if (!res.ok) throw new Error(`coverConfig.json responded ${res.status}`);
    const config = await res.json();

    document.getElementById('editionTag').textContent = config.editionTag || '';
    const coverlines = Array.isArray(config.coverlines) ? config.coverlines : [];
    renderCoverlines(coverlines);

    COVER_SCENES.default.image = config.backgroundImage || null;
    applyCoverScene(COVER_SCENES.default.image ? 'default' : 'proceduralFallback');

    const episode = await fetchHistoryDailyEpisode();
    applyHistoryDailyEpisode(episode, coverlines);
  } catch (err) {
    console.warn('coverConfig.json failed to load, falling back to the procedural scene:', err);
    applyCoverScene('proceduralFallback');
  }
}

loadCoverConfig();

// ---------- radio spectrum (decorative bars, not real audio analysis) ----------
(function spectrum() {
  const el = document.getElementById('radioSpectrum');
  const BARS = 24;
  for (let i = 0; i < BARS; i++) {
    const bar = document.createElement('div');
    bar.className = 'spectrum-bar';
    bar.style.animationDelay = `${(Math.random() * 1.2).toFixed(2)}s`;
    bar.style.animationDuration = `${(0.9 + Math.random() * 0.8).toFixed(2)}s`;
    el.appendChild(bar);
  }
})();

// ---------- footer: real Earth time ----------
(function footerMeta() {
  const earthEl = document.getElementById('footerEarthTime');

  function tick() {
    const now = new Date();
    earthEl.textContent = now.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  tick();
  setInterval(tick, 1000);
})();

// ---------- radio play/pause — REAL audio via the #radioAudio element ----------
// BBC World Service, the same real, HTTPS, CORS-enabled stream URL already
// used by the real Ai One app's Radio Central — verified here via an
// actual browser canplay/playing event before wiring this up, not just an
// HTTP status check (see the comment on the <audio> tag in index.html).
// One real Audio object, one real play state, shared by every control on
// the page (sidebar + dashboard) so they never drift out of sync with
// what's actually playing.
const radioAudio = document.getElementById('radioAudio');
let radioPlaying = false;

function setButtonIcon(icon, label) {
  ['radioPlayBtn', 'rcPlayBtn'].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.textContent = icon;
    btn.setAttribute('aria-label', label);
  });
}

function setStatusText(text) {
  const sidebarSub = document.getElementById('radioStationSub');
  const footerSub = document.getElementById('rcFooterSub');
  if (sidebarSub) sidebarSub.textContent = text;
  if (footerSub) footerSub.textContent = text;
}

function setRadioPlaying(next) {
  if (next) {
    radioAudio.play().catch((err) => {
      // Real failure (network error, browser blocked it, etc.) — say so
      // honestly instead of leaving the button stuck on "pause" for audio
      // that isn't actually playing.
      console.warn('Radio stream failed to start:', err);
      radioPlaying = false;
      setButtonIcon('▶', 'Play');
      setStatusText('Stream failed to start — try again');
    });
  } else {
    radioAudio.pause();
  }
}

// The audio element's own real events are the source of truth for button
// state — covers cases setRadioPlaying(true) doesn't (buffering stalls,
// the stream dropping mid-play, etc.), not just the click that started it.
// Reflects whether EITHER audio source is actually playing — radioAudio
// (BBC World Service) or offGridAudio (the "Ai, Off Grid and DIY" story).
// Previously this badge was scoped strictly to radioAudio; it's now a
// shared "something on this page is live" indicator by explicit request.
function updateLiveIndicator() {
  const badge = document.querySelector('.radio-live');
  const active = radioPlaying || (typeof offGridAudio !== 'undefined' && !offGridAudio.paused);
  if (badge) badge.classList.toggle('is-live-active', active);
}

radioAudio.addEventListener('playing', () => {
  radioPlaying = true;
  setButtonIcon('❚❚', 'Pause');
  setStatusText('Live now — BBC World Service');
  updateLiveIndicator();
});
radioAudio.addEventListener('pause', () => {
  radioPlaying = false;
  setButtonIcon('▶', 'Play');
  setStatusText('Default station — press play to start streaming');
  updateLiveIndicator();
});
radioAudio.addEventListener('waiting', () => setStatusText('Buffering…'));
radioAudio.addEventListener('error', () => {
  radioPlaying = false;
  setButtonIcon('▶', 'Play');
  setStatusText('Stream unavailable right now — try again later');
  updateLiveIndicator();
});

document.getElementById('radioPlayBtn').addEventListener('click', () => setRadioPlaying(!radioPlaying));
document.getElementById('rcPlayBtn').addEventListener('click', () => setRadioPlaying(!radioPlaying));
document.getElementById('rcTuneBtn').addEventListener('click', () => setRadioPlaying(true));
document.getElementById('rcFooterTuneBtn').addEventListener('click', () => setRadioPlaying(true));

// ---------- "Ai, Off Grid and DIY" standalone endpoint player ----------
// A real Audio object of its own, entirely separate from radioAudio above
// — this coverline is a direct-play endpoint, not a station: clicking it
// (or its play icon) must never shift Radio Central's tuned station, open
// the dashboard view, or navigate away. It's excluded from any station
// rotation for the same reason. The click handling itself lives directly
// on the card (see the 'audio' branch in renderCoverlines above) — this
// object is just the shared native <audio> engine and its icon-state
// listeners below.
const offGridAudio = new Audio();

offGridAudio.addEventListener('play', () => {
  document.querySelectorAll('.coverline-play-icon').forEach((el) => (el.textContent = '❚❚'));
  document.getElementById('offGridCover')?.classList.add('is-playing');
  updateLiveIndicator();
});
offGridAudio.addEventListener('pause', () => {
  document.querySelectorAll('.coverline-play-icon').forEach((el) => (el.textContent = '▶'));
  document.getElementById('offGridCover')?.classList.remove('is-playing');
  updateLiveIndicator();
  const badge = document.querySelector('.coverline-click-badge');
  if (badge) badge.textContent = '';
  const link = document.querySelector('[data-audio-src]');
  if (link) link.style.borderLeftColor = '';
});

// Two volume sliders (sidebar + dashboard) kept in sync with each other
// and with the real audio element's actual volume.
(function syncVolume() {
  const sidebarVol = document.querySelector('.radio-volume');
  const rcVol = document.getElementById('rcVolumeSlider');
  const rcStat = document.getElementById('rcVolumeStat');

  function apply(value) {
    sidebarVol.value = value;
    rcVol.value = value;
    rcStat.textContent = `${value}%`;
    radioAudio.volume = Number(value) / 100;
  }

  apply(sidebarVol.value);
  sidebarVol.addEventListener('input', (e) => apply(e.target.value));
  rcVol.addEventListener('input', (e) => apply(e.target.value));
})();

// ---------- focus-panel (Radio Central coverline — real panel, not a modal) ----------
// Scrolls the target panel into view, gives it a brief pulse highlight so
// the jump reads as intentional, and starts real playback.
function focusPanel(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('panel-pulse');
  setTimeout(() => el.classList.remove('panel-pulse'), 1400);
  setRadioPlaying(true);
}

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-focus]');
  if (!trigger) return;
  e.preventDefault();
  focusPanel(trigger.dataset.focus);
});

// ---------- view transitions (main shell <-> Radio Central dashboard) ----------
// Plain class toggles — .view-container's CSS transition (perspective
// rotateY) does the actual "book flip." This script only ever runs after
// the DOM it targets already exists (script tag sits at the end of body),
// so no DOMContentLoaded wrapper is needed here.
function openView(viewId) {
  document.querySelectorAll('.view-container').forEach((el) => el.classList.remove('active-view'));
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active-view');
}

document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-open-view]');
  if (opener) {
    e.preventDefault();
    openView(opener.dataset.openView);
    return;
  }
  const backBtn = e.target.closest('#back-to-home-btn');
  if (backBtn) {
    e.preventDefault();
    openView('main-landing-view');
  }
});

// ---------- Radio Central dashboard: real text filter + category toggle ----------
(function radioCentralFilter() {
  const input = document.getElementById('rcFilterInput');
  const cats = document.querySelectorAll('.rc-cat');
  if (!input) return;

  let activeCat = 'all';

  function applyFilter() {
    const query = input.value.trim().toLowerCase();
    // Queried fresh on every call, not cached once at load — renderPlaylist()
    // (below) rebuilds these rows dynamically, so a stale NodeList captured
    // here at IIFE-init time would miss anything added after a re-render.
    document.querySelectorAll('#rcChannelList .rc-chan-item').forEach((row) => {
      const matchesText = row.dataset.rcName.includes(query);
      const matchesCat = activeCat === 'all' || row.dataset.rcCat === activeCat;
      row.hidden = !(matchesText && matchesCat);
    });
  }

  input.addEventListener('input', applyFilter);

  cats.forEach((btn) => {
    btn.addEventListener('click', () => {
      cats.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeCat = btn.dataset.rcCat;
      applyFilter();
    });
  });
})();

// ---------- Dynamic Track Loader: central playlist + multi-source player ----------
// Replaces the old hardcoded 3-row #rcChannelList markup with rows rendered
// from a real data array, and switches the real offGridAudio HTML5 element
// in place on click — no page reload, no navigation. Playlist.tracks is the
// single source of truth: add more {title, artist, duration, url} entries
// here and they show up automatically, no other code changes needed.
const Playlist = {
  tracks: [
    {
      id: 'bbc-world-service',
      title: 'BBC World Service',
      artist: 'BBC',
      duration: null, // live stream — no fixed duration
      url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
      category: 'news',
      badge: 'BBC',
    },
    {
      id: 'living-off-grid',
      // Placeholder copy — replaced by applyHistoryDailyEpisode() once the
      // real feed resolves (or set to an explicit "(unavailable)" state on
      // failure). url stays null until then; playTrack() guards against
      // that. No local-file fallback here on purpose: a stale MP3 frozen
      // to whatever episode existed on some past day would be actively
      // misleading under a live "History Daily" title — see script history.
      title: 'History Daily — loading…',
      artist: '',
      duration: null,
      url: null,
      category: 'cosmic',
      badge: 'HD',
    },
  ],
  currentIndex: -1,
};

function resolveTrackUrl(url) {
  return /^https?:\/\//i.test(url) ? url : url.replace(/^\/+/, '');
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return 'LIVE';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function renderPlaylist() {
  const list = document.getElementById('rcChannelList');
  if (!list) return;

  list.innerHTML = '<span class="rc-section-label">CHANNELS</span>';

  Playlist.tracks.forEach((track, index) => {
    const isPlaying = index === Playlist.currentIndex && !offGridAudio.paused;

    const row = document.createElement('div');
    row.className = 'rc-chan-item' + (isPlaying ? ' is-playing' : '');
    row.dataset.rcName = track.title.toLowerCase();
    row.dataset.rcCat = track.category || 'all';
    row.setAttribute('role', 'button');
    row.tabIndex = 0;

    const logo = document.createElement('span');
    logo.className = 'rc-chan-logo';
    logo.textContent = track.badge || track.title.slice(0, 3).toUpperCase();

    const info = document.createElement('div');
    const h4 = document.createElement('h4');
    h4.textContent = track.title;
    const p = document.createElement('p');
    p.textContent = `${track.artist} · ${formatDuration(track.duration)}`;
    info.appendChild(h4);
    info.appendChild(p);

    const tag = document.createElement('span');
    tag.className = 'rc-chan-tag';
    tag.textContent = isPlaying ? 'PLAYING' : 'PLAY';

    row.appendChild(logo);
    row.appendChild(info);
    row.appendChild(tag);

    const activate = () => playTrack(index);
    row.addEventListener('click', activate);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });

    list.appendChild(row);
  });

  syncSidebarHistoryDailyRow();
}

// Keeps the sidebar's History Daily row (see index.html's .channel-list) in
// sync with the same Playlist.tracks entry the dashboard row and coverline
// card already share — called from every place renderPlaylist() already is,
// so no new call sites are needed elsewhere.
function syncSidebarHistoryDailyRow() {
  const nameEl = document.getElementById('sidebarHistoryDailyName');
  const tagEl = document.getElementById('sidebarHistoryDailyTag');
  if (!nameEl || !tagEl) return;

  const index = Playlist.tracks.findIndex((t) => t.id === 'living-off-grid');
  const track = Playlist.tracks[index];
  if (!track) return;

  const isPlaying = index === Playlist.currentIndex && !offGridAudio.paused;
  nameEl.textContent = track.title;
  tagEl.textContent = isPlaying ? 'PLAYING' : 'PLAY';
}

function updateOnAirCard(track) {
  const card = document.querySelector('.rc-on-air-card');
  if (!card) return;
  const badge = card.querySelector('.rc-station-badge');
  const h3 = card.querySelector('.rc-station-info h3');
  const p = card.querySelector('.rc-station-info p');
  if (badge) badge.textContent = track.badge || track.title.slice(0, 3).toUpperCase();
  if (h3) h3.textContent = track.title;
  if (p) p.textContent = `${track.artist} · ${formatDuration(track.duration)}`;
}

function playTrack(index) {
  const track = Playlist.tracks[index];
  if (!track) return;
  if (!track.url) {
    console.warn('Track has no playable URL yet:', track.id);
    return;
  }
  Playlist.currentIndex = index;

  const resolvedUrl = resolveTrackUrl(track.url);
  // Reuses the existing standalone offGridAudio <audio> engine (already
  // decoupled from Radio Central's own dedicated radioAudio element)
  // instead of standing up a third parallel player.
  if (radioPlaying) setRadioPlaying(false);
  offGridAudio.dataset.currentSrc = resolvedUrl;
  offGridAudio.src = resolvedUrl;
  offGridAudio.play().catch((err) => console.warn('Playlist track failed to play:', err));

  updateOnAirCard(track);
  renderPlaylist();
}

renderPlaylist();
// Keep the PLAYING/PLAY tags and row highlight in sync with the real audio
// element's own state — covers pausing/resuming from any control, not just
// a fresh click here.
offGridAudio.addEventListener('play', renderPlaylist);
offGridAudio.addEventListener('pause', renderPlaylist);

// Sidebar History Daily row — same entry point the dashboard row uses.
const sidebarHistoryDailyRow = document.getElementById('sidebarHistoryDailyRow');
if (sidebarHistoryDailyRow) {
  const activateSidebarHistoryDaily = () => {
    const index = Playlist.tracks.findIndex((t) => t.id === 'living-off-grid');
    if (index !== -1) playTrack(index);
  };
  sidebarHistoryDailyRow.addEventListener('click', activateSidebarHistoryDaily);
  sidebarHistoryDailyRow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activateSidebarHistoryDaily();
    }
  });
}

// ---------- demo overlays ----------
// `cta` is only set on entries with a real, confirmed destination — see
// the note above Star Tracker's entry. Never fabricate a subdomain that
// doesn't actually resolve; an entry with no confirmed destination just
// omits `cta` and stays teaser-only until one exists.
const OVERLAY_CONTENT = {
  'pricing': {
    badge: 'AI ONE PRO',
    title: 'Start Your 14-Day Free Trial',
    body: '$12/month after trial. Cancel anytime. New subscribers unlock full access to Ai One and every platform feature — Kali AI, Radio Central, Star Tracker, and the full product catalog.',
    // Real Stripe Payment Link — same AIONE_PRO_SUBSCRIPTION_LINK the real
    // Ai One app's own PricingPlans.tsx/PurchaseButton use, so subscribing
    // here goes to the same real $12/mo + 14-day-trial checkout.
    cta: { label: 'Start 14-Day Free Trial →', href: 'https://buy.stripe.com/bJefZaaW92S06up9kw7wA02', newTab: true },
  },
  'social': {
    badge: 'DEMO MODE',
    title: 'Social links',
    body: 'Placeholder — no real social accounts are linked yet in this demo shell.',
  },
};

(function overlays() {
  const overlay = document.getElementById('overlay');
  const overlayBadge = document.getElementById('overlayBadge');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayBody = document.getElementById('overlayBody');
  const overlayCta = document.getElementById('overlayCta');
  const closeBtn = document.getElementById('overlayClose');

  function open(key) {
    const content = OVERLAY_CONTENT[key];
    if (!content) return;
    overlayBadge.textContent = content.badge || 'DEMO MODE';
    overlayTitle.textContent = content.title;
    overlayBody.textContent = content.body;

    if (content.cta) {
      overlayCta.textContent = content.cta.label;
      overlayCta.href = content.cta.href;
      if (content.cta.newTab) {
        overlayCta.target = '_blank';
        overlayCta.rel = 'noopener noreferrer';
      } else {
        overlayCta.removeAttribute('target');
        overlayCta.removeAttribute('rel');
      }
      overlayCta.style.display = '';
    } else {
      overlayCta.style.display = 'none';
    }

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  // Delegated (not queried-and-bound-once) so this also covers the
  // coverline links, which don't exist yet until loadCoverConfig() renders
  // them — no ordering dependency between the two scripts.
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-overlay]');
    if (!trigger) return;
    e.preventDefault();
    open(trigger.getAttribute('data-overlay'));
  });

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
})();

// ---------- real auth overlay (iframe → real Ai One Supabase modal) ----------
// Not a demo: [data-open-auth] loads the genuine cosmic-clock AuthModal,
// running on its own real origin, via ?embed=1 (renders just the modal,
// no app chrome — see cosmic-clock's app/page.tsx). The href on these links
// stays a real fallback for no-JS/blocked-iframe cases.
(function authOverlay() {
const AUTH_BASE = 'https://startracker.protolabsglobal.com';  const overlay = document.getElementById('authOverlay');
  const frame = document.getElementById('authFrame');
  const closeBtn = document.getElementById('authOverlayClose');
  if (!overlay || !frame || !closeBtn) return;

  function open(mode) {
    frame.src = `${AUTH_BASE}?auth=${mode}&embed=1`;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    // Clear the src so the embedded session/audio doesn't keep running
    // in the background once dismissed.
    frame.src = 'about:blank';
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-open-auth]');
    if (!trigger) return;
    e.preventDefault();
    open(trigger.getAttribute('data-open-auth'));
  });

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  // The real AuthModal posts this on close/success (see cosmic-clock's
  // AuthModal onClose handler in embed mode) — auto-close in response.
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'cosmic-auth-closed') close();
  });
})();

// ---------- global ambient starfield (behind the whole shell) ----------
// Standalone, not wired into applyCoverScene — the canvas's own #starfield
// stays exactly as it was. Same lightweight .star/twinkle CSS, just a
// second, sparser layer so the header/radio-panel/footer aren't sitting on
// flat dark backgrounds.
(function ambientStars() {
  const el = document.getElementById('ambientStars');
  if (!el) return;
  const COUNT = 60;
  for (let i = 0; i < COUNT; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = (0.5 + Math.random() * 1.3).toFixed(2);
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${(Math.random() * 100).toFixed(2)}%`;
    star.style.top = `${(Math.random() * 100).toFixed(2)}%`;
    star.style.animationDuration = `${(3 + Math.random() * 5).toFixed(2)}s`;
    star.style.animationDelay = `${(Math.random() * 4).toFixed(2)}s`;
    el.appendChild(star);
  }
})();

// ---------- hero canvas: macOS-style hyperspace warp over the artwork ----------
// Independent of #starfield's static CSS dots — genuine motion via
// requestAnimationFrame, not a duplicate. Only touches #hero-star-canvas;
// the background image and radio panel are untouched. Classic warp-speed
// screensaver model: each star travels outward along a fixed ray from the
// center, accelerating and growing as it approaches (z -> max radius),
// with a short trailing streak for motion blur, then resets near center
// once it exits so the stream is continuous rather than looping visibly.
(function heroStarCanvas() {
  const canvas = document.getElementById('hero-star-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  const COUNT = 220;
  let particles = [];
  let dpr = window.devicePixelRatio || 1;
  let maxRadius = 0;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    maxRadius = Math.hypot(rect.width, rect.height) / 2 + 40;
  }

  function resetParticle(p, spawnAnywhere) {
    p.angle = Math.random() * Math.PI * 2;
    p.z = spawnAnywhere ? Math.random() * maxRadius : Math.random() * maxRadius * 0.06;
    p.speed = 0.35 + Math.random() * 0.5;
    p.isCyan = Math.random() < 0.3;
    p.px = null;
    p.py = null;
  }

  function makeParticle() {
    const p = {};
    resetParticle(p, true);
    return p;
  }

  function init() {
    resize();
    particles = Array.from({ length: COUNT }, makeParticle);
  }

  let lastTime = performance.now();
  function tick(now) {
    const dt = Math.min(64, now - lastTime) / 16.6667; // ~frames at 60fps, capped
    lastTime = now;
    const rect = parent.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    ctx.clearRect(0, 0, rect.width, rect.height);

    for (const p of particles) {
      // Accelerates as it gets farther out — genuinely reads as approaching
      // the viewer rather than a constant-speed drift.
      const t = p.z / maxRadius;
      p.z += p.speed * (0.6 + t * 2.2) * dt;

      const x = cx + Math.cos(p.angle) * p.z;
      const y = cy + Math.sin(p.angle) * p.z;

      if (p.z > maxRadius || x < -20 || x > rect.width + 20 || y < -20 || y > rect.height + 20) {
        resetParticle(p, false);
        continue;
      }

      const radius = 0.4 + t * 2.0;
      const opacity = Math.min(1, t * 1.6) * 0.85;
      const color = p.isCyan ? '150, 230, 255' : '255, 255, 255';

      if (p.px !== null) {
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(x, y);
        ctx.strokeStyle = `rgba(${color}, ${(opacity * 0.5).toFixed(3)})`;
        ctx.lineWidth = radius;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color}, ${opacity.toFixed(3)})`;
      ctx.shadowColor = `rgba(${color}, ${(opacity * 0.8).toFixed(3)})`;
      ctx.shadowBlur = 3;
      ctx.fill();

      p.px = x;
      p.py = y;
    }
    requestAnimationFrame(tick);
  }

  init();
  window.addEventListener('resize', resize);
  requestAnimationFrame(tick);
})();
