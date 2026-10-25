// Tiny WebAudio synth for HUD sounds. No audio files; the context is created
// lazily and only after a user gesture (autoplay policies).
let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

/** Two-tone "target lock" blip. Silent if audio has not been unlocked yet. */
export function playTargetLock(): void {
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
  gain.connect(ctx.destination);
  for (const [f, start] of [[880, 0], [1320, 0.07]] as const) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(f, t0 + start);
    osc.connect(gain);
    osc.start(t0 + start);
    osc.stop(t0 + start + 0.08);
  }
}

export function playAlarm(): void {
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, t0);
  osc.frequency.linearRampToValueAtTime(220, t0 + 0.25);
  gain.gain.setValueAtTime(0.06, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.3);
}
