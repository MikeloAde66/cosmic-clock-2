import factsRaw from '@/lib/astroSim/atlas-facts.json';

// Worlds offered by the Planet Atlas. Tile layout, layer names and native zoom
// ranges were read from NASA Solar System Treks' own WMTS descriptions and
// probed tile by tile (see the commit message). Add a world only after the
// same check.
export interface AtlasFact {
  label: string;
  value: string;
  unit: string;
}

export interface AtlasWorld {
  id: 'moon' | 'mars';
  name: string;
  /** Tile URL with Leaflet placeholders. Row/col follow the WMTS top-left origin. */
  tiles: string;
  /** Deepest zoom that has real tiles. */
  maxNativeZoom: number;
  layer: string;
  imageryCredit: string;
  factsSource: string;
  factsUpdated: string | null;
  facts: AtlasFact[];
}

const TREK = 'https://trek.nasa.gov/tiles';
const worlds = factsRaw.worlds;

export const ATLAS_WORLDS: AtlasWorld[] = [
  {
    id: 'moon',
    name: 'Moon',
    tiles: `${TREK}/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`,
    maxNativeZoom: 8,
    layer: 'LRO_WAC_Mosaic_Global_303ppd_v02',
    imageryCredit: 'LRO Wide Angle Camera global mosaic (LRO_WAC_Mosaic_Global_303ppd_v02)',
    factsSource: worlds.moon.source,
    factsUpdated: worlds.moon.lastUpdated,
    facts: worlds.moon.facts,
  },
  {
    id: 'mars',
    name: 'Mars',
    tiles: `${TREK}/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`,
    maxNativeZoom: 7,
    layer: 'Mars_Viking_MDIM21_ClrMosaic_global_232m',
    imageryCredit: 'Viking MDIM 2.1 colourised global mosaic (Mars_Viking_MDIM21_ClrMosaic_global_232m)',
    factsSource: worlds.mars.source,
    factsUpdated: worlds.mars.lastUpdated,
    facts: worlds.mars.facts,
  },
];
