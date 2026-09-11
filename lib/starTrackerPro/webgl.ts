// Cheap synchronous WebGL availability probe, run before mounting the R3F
// Canvas at all. Distinct from context-loss handling (see
// StarTrackerProCanvas's 'webglcontextlost' listener) — this catches the
// case where a context can never be created in the first place (disabled
// GPU process, `--disable-webgl`, headless CI, some older WebViews), which
// throws synchronously and would otherwise blow past R3F straight out of
// `getContext`.
export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}
