// Live loudness of whatever Signal is playing, for the wave on the home page.
// The audio element is routed through an analyser once; the wave reads
// `readLevel()` each frame. Nothing is recorded.
let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let source: MediaElementAudioSourceNode | null = null;
let current: HTMLAudioElement | null = null;
let buf: Uint8Array<ArrayBuffer> | null = null;

export function attachLevel(el: HTMLAudioElement) {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
    analyser ??= Object.assign(ctx.createAnalyser(), { fftSize: 512 });
    buf ??= new Uint8Array(analyser.fftSize);
    source?.disconnect();
    current = el;
    source = ctx.createMediaElementSource(el);
    source.connect(analyser);
    analyser.connect(ctx.destination);
  } catch {
    source = null;
  }
}

export function detachLevel() {
  current = null;
  source?.disconnect();
  source = null;
}

export function readLevel(): number {
  if (!analyser || !buf || !source) return 0;
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (const v of buf) sum += ((v - 128) / 128) ** 2;
  return Math.min(1, Math.sqrt(sum / buf.length) * 7);
}

export const isPlaying = () => !!current && !current.paused;
