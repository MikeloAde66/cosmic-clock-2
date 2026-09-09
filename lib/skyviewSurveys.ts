// NASA/GSFC SkyView (skyview.gsfc.nasa.gov) — a real, public virtual
// observatory HTTP API, not a stand-in/placeholder image service. Verified
// by hand (curl, real HTTP 200 + image/jpeg) against each of these four
// survey identifiers before wiring this in — see StarTrackerView's Deep Sky
// Spectrum tab for where it's used. runquery.pl returns a real cutout JPEG
// directly for a given Survey + Position, no API key required.
export type SkyBand = 'optical' | 'infrared' | 'radio' | 'xray';

const SKYVIEW_SURVEY: Record<SkyBand, string> = {
  optical: 'DSS',
  infrared: '2MASS-K',
  radio: 'NVSS',
  xray: 'RASS-Cnt Broad',
};

export const SKY_BAND_LABELS: Record<SkyBand, string> = {
  optical: 'Optical — DSS',
  infrared: 'Infrared — 2MASS (K-band)',
  radio: 'Radio — NVSS (1.4 GHz)',
  xray: 'X-Ray — ROSAT All-Sky Survey',
};

export const SKY_BAND_ORDER: SkyBand[] = ['optical', 'infrared', 'radio', 'xray'];

export function skyviewCutoutUrl(raDeg: number, decDeg: number, band: SkyBand, sizeDeg: number): string {
  const params = new URLSearchParams({
    Survey: SKYVIEW_SURVEY[band],
    position: `${raDeg},${decDeg}`,
    size: String(sizeDeg),
    pixels: '400',
    Return: 'JPEG',
  });
  return `https://skyview.gsfc.nasa.gov/current/cgi/runquery.pl?${params.toString()}`;
}
