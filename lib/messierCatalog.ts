// A curated subset of the Messier catalog — real, well-documented public
// astronomical coordinates (RA in hours, Dec in degrees, J2000), not the
// full 110-object catalog. Picked for being bright/famous enough to be
// meaningfully "findable" on a small sky dome rather than cluttering it.
export interface MessierObject {
  id: string; // e.g. "M31"
  name: string; // common name
  raHours: number;
  decDeg: number;
  magnitude: number;
  type: string;
  distanceLy: number; // light-years, well-established public estimates
}

export const MESSIER_OBJECTS: MessierObject[] = [
  { id: 'M31', name: 'Andromeda Galaxy', raHours: 0.7123, decDeg: 41.27, magnitude: 3.4, type: 'Galaxy', distanceLy: 2_537_000 },
  // 1,500 ly per NASA's own Hubble Messier Catalog page for M42, which this
  // node's archive link points to — kept consistent with the source cited.
  { id: 'M42', name: 'Orion Nebula', raHours: 5.5883, decDeg: -5.39, magnitude: 4.0, type: 'Nebula', distanceLy: 1_500 },
  { id: 'M45', name: 'Pleiades', raHours: 3.79, decDeg: 24.12, magnitude: 1.6, type: 'Open Cluster', distanceLy: 444 },
  { id: 'M13', name: 'Hercules Cluster', raHours: 16.6947, decDeg: 36.46, magnitude: 5.8, type: 'Globular Cluster', distanceLy: 22_200 },
  { id: 'M51', name: 'Whirlpool Galaxy', raHours: 13.4981, decDeg: 47.2, magnitude: 8.4, type: 'Galaxy', distanceLy: 23_000_000 },
  { id: 'M57', name: 'Ring Nebula', raHours: 18.8933, decDeg: 33.03, magnitude: 8.8, type: 'Nebula', distanceLy: 2_283 },
  { id: 'M8', name: 'Lagoon Nebula', raHours: 18.06, decDeg: -24.38, magnitude: 6.0, type: 'Nebula', distanceLy: 4_100 },
  { id: 'M27', name: 'Dumbbell Nebula', raHours: 19.9933, decDeg: 22.72, magnitude: 7.5, type: 'Nebula', distanceLy: 1_360 },
  { id: 'M104', name: 'Sombrero Galaxy', raHours: 12.6664, decDeg: -11.62, magnitude: 8.0, type: 'Galaxy', distanceLy: 29_300_000 },
  { id: 'M1', name: 'Crab Nebula', raHours: 5.5756, decDeg: 22.02, magnitude: 8.4, type: 'Nebula', distanceLy: 6_500 },
];
