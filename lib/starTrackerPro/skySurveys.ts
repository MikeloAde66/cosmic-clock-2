// Real full-sky equirectangular survey textures for the multi-spectrum
// shader. Each entry's sourceUrl is a real, verified-reachable public NASA
// asset (checked directly — HTTP 200, real image/jpeg content — before
// being listed here), not a guessed or placeholder URL. Every one of them
// lacks the CORS headers a browser needs to use it directly as a WebGL
// texture cross-origin (verified: no permissive Access-Control-Allow-
// Origin on either), so app/api/skySurveys/[survey] fetches the real bytes
// server-side and re-serves them same-origin — a proxy, not a workaround
// for anything the source intends to restrict; these are public-domain
// NASA outreach assets.
export type SkySurveyId = 'optical' | 'infrared' | 'hAlpha';

export interface SkySurveyDefinition {
  id: SkySurveyId;
  label: string;
  sourceUrl: string | null; // null = no verified real source yet, see `available`
  attribution: string;
  available: boolean;
}

export const SKY_SURVEYS: Record<SkySurveyId, SkySurveyDefinition> = {
  optical: {
    id: 'optical',
    label: 'Optical',
    sourceUrl: 'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_4k_print.jpg',
    attribution: 'NASA/Goddard Space Flight Center Scientific Visualization Studio — Deep Star Maps 2020',
    available: true,
  },
  infrared: {
    id: 'infrared',
    label: 'WISE Infrared',
    sourceUrl: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia15/pia15482/PIA15482.jpg',
    attribution: 'NASA/JPL-Caltech — WISE All-Sky Survey (PIA15482)',
    available: true,
  },
  // No real, verified, freely-downloadable full-sky H-alpha equirectangular
  // JPEG/PNG was found in the time available for this pass (the real
  // sources that exist — e.g. the Finkbeiner H-alpha survey — are
  // distributed as large tiled/FITS mosaics, not a single flat texture
  // ready to drop in here). Left honestly unavailable rather than pointing
  // at a fabricated or unverified URL; the shader and UI both already
  // support it the moment a real source is confirmed.
  hAlpha: {
    id: 'hAlpha',
    label: 'Hydrogen-Alpha',
    sourceUrl: null,
    attribution: '',
    available: false,
  },
};

export const SKY_SURVEY_ORDER: SkySurveyId[] = ['optical', 'infrared', 'hAlpha'];
