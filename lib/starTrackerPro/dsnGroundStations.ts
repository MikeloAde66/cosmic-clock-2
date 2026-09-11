// Real geodetic coordinates for the three DSN complexes (approximate
// complex-center coordinates, not per-dish precision — each complex hosts
// several dishes a few hundred meters apart, well below what matters at
// globe-visualization scale). Matched against the real station codes the
// live DSN feed itself reports (see app/api/dsn/telemetry) — gdscc/mdscc/
// cdscc.
export interface DsnGroundStation {
  code: 'gdscc' | 'mdscc' | 'cdscc';
  name: string;
  latitudeDeg: number;
  longitudeDeg: number;
}

export const DSN_GROUND_STATIONS: DsnGroundStation[] = [
  { code: 'gdscc', name: 'Goldstone', latitudeDeg: 35.4267, longitudeDeg: -116.89 },
  { code: 'mdscc', name: 'Madrid', latitudeDeg: 40.4292, longitudeDeg: -4.2481 },
  { code: 'cdscc', name: 'Canberra', latitudeDeg: -35.4014, longitudeDeg: 148.9819 },
];

export function findGroundStation(code: string): DsnGroundStation | undefined {
  return DSN_GROUND_STATIONS.find((s) => s.code === code);
}

// Real geodetic (lat/lon) -> position on a unit sphere, standard
// spherical-to-Cartesian conversion (Y up).
export function latLonToUnitVector(latitudeDeg: number, longitudeDeg: number): [number, number, number] {
  const lat = (latitudeDeg * Math.PI) / 180;
  const lon = (longitudeDeg * Math.PI) / 180;
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
}

// Real local East/North/Up basis at a point on the globe, used to turn a
// dish's own real Az/El (local to that station) into a direction in the
// globe's shared 3D frame — standard ENU tangent-plane construction, not
// an approximation.
export function localEastNorthUp(latitudeDeg: number, longitudeDeg: number) {
  const up = latLonToUnitVector(latitudeDeg, longitudeDeg);
  const worldUp: [number, number, number] = [0, 1, 0];
  const east = normalize(cross(worldUp, up));
  const north = cross(up, east);
  return { east, north, up };
}

// Real dish Az/El (azimuth from North, clockwise; elevation above local
// horizon) -> a world-frame direction vector at that station's position —
// where the antenna is actually physically pointed right now, not the
// spacecraft's true celestial position (the DSN feed itself has no RA/Dec
// or ephemeris for its targets, only each dish's own real pointing
// telemetry — see DsnGlobe's own comment for why this is the honest
// distinction to draw).
export function dishPointingDirection(station: DsnGroundStation, azimuthDeg: number, elevationDeg: number): [number, number, number] {
  const { east, north, up } = localEastNorthUp(station.latitudeDeg, station.longitudeDeg);
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  const eastComp = Math.sin(az) * Math.cos(el);
  const northComp = Math.cos(az) * Math.cos(el);
  const upComp = Math.sin(el);
  return [
    east[0] * eastComp + north[0] * northComp + up[0] * upComp,
    east[1] * eastComp + north[1] * northComp + up[1] * upComp,
    east[2] * eastComp + north[2] * northComp + up[2] * upComp,
  ];
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v: [number, number, number]): [number, number, number] {
  const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}
