// A small controller around the browser's speech synthesis. It reads a list of
// short chunks one after another, so long text is never cut off, and keeps
// the bookkeeping (which chunk, paused or not) out of the React components.
// Browser only: call it from an effect or an event handler.

export type ReaderStatus = 'idle' | 'speaking' | 'paused';

export interface ReaderState {
  status: ReaderStatus;
  index: number;
  total: number;
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  return en.find((v) => v.localService && /en[-_]us/i.test(v.lang)) ?? en.find((v) => v.localService) ?? en[0];
}

export function createReader(onChange: (s: ReaderState) => void, onFinished: () => void) {
  const synth = window.speechSynthesis;
  let run = 0;
  let chunks: string[] = [];
  let rate = 1;
  let state: ReaderState = { status: 'idle', index: 0, total: 0 };

  const set = (patch: Partial<ReaderState>) => {
    state = { ...state, ...patch };
    onChange(state);
  };

  const finish = () => {
    set({ status: 'idle', index: 0, total: 0 });
    onFinished();
  };

  const speakAt = (i: number, id: number) => {
    if (id !== run) return;
    if (i >= chunks.length) {
      finish();
      return;
    }
    const u = new SpeechSynthesisUtterance(chunks[i]);
    u.rate = rate;
    u.lang = 'en-US';
    const v = pickVoice();
    if (v) u.voice = v;
    u.onend = () => {
      if (id !== run) return;
      set({ index: i + 1 });
      speakAt(i + 1, id);
    };
    u.onerror = (e) => {
      if (id !== run) return;
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      run++;
      finish();
    };
    try {
      synth.speak(u);
    } catch {
      // the engine refused: end cleanly rather than leave the controls stuck
      run++;
      finish();
    }
  };

  return {
    start(list: string[]) {
      synth.cancel();
      run++;
      chunks = list;
      set({ status: 'speaking', index: 0, total: list.length });
      speakAt(0, run);
    },
    pause() {
      if (state.status !== 'speaking') return;
      synth.pause();
      set({ status: 'paused' });
    },
    resume() {
      if (state.status !== 'paused') return;
      synth.resume();
      set({ status: 'speaking' });
    },
    /** stop and report as finished, so the caller can hand the audio back */
    stop() {
      if (state.status === 'idle') return;
      run++;
      synth.cancel();
      finish();
    },
    setRate(r: number) {
      rate = r; // takes effect from the next chunk
    },
    /** stop quietly, for when the page goes away */
    destroy() {
      run++;
      synth.cancel();
    },
  };
}

/**
 * The same controls for a pre-recorded mp3. Progress is reported out of 1000.
 * If the file cannot be played, `onFail` is called so the caller can fall back
 * to the browser's own voice.
 */
export function createAudioReader(src: string, onChange: (s: ReaderState) => void, onFinished: () => void, onFail: () => void) {
  const el = new Audio(src);
  el.preload = 'auto';
  let rate = 1;
  let closed = false;
  let state: ReaderState = { status: 'idle', index: 0, total: 1000 };

  const set = (patch: Partial<ReaderState>) => {
    state = { ...state, ...patch };
    onChange(state);
  };
  const close = () => {
    closed = true;
    el.pause();
    el.removeAttribute('src');
    el.load();
  };
  const fail = () => {
    if (closed) return;
    close();
    set({ status: 'idle', index: 0 });
    onFail();
  };

  el.addEventListener('timeupdate', () => {
    if (!closed && el.duration) set({ index: Math.round((1000 * el.currentTime) / el.duration) });
  });
  el.addEventListener('ended', () => {
    if (closed) return;
    close();
    set({ status: 'idle', index: 0 });
    onFinished();
  });
  el.addEventListener('error', fail);

  return {
    start() {
      el.playbackRate = rate;
      set({ status: 'speaking', index: 0 });
      el.play().catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        fail();
      });
    },
    pause() {
      if (state.status !== 'speaking') return;
      el.pause();
      set({ status: 'paused' });
    },
    resume() {
      if (state.status !== 'paused') return;
      set({ status: 'speaking' });
      void el.play().catch(fail);
    },
    stop() {
      if (closed) return;
      close();
      set({ status: 'idle', index: 0 });
      onFinished();
    },
    setRate(r: number) {
      rate = r;
      el.playbackRate = r; // a recording can change speed straight away
    },
    destroy() {
      close();
    },
  };
}
