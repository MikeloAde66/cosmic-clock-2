# Astro Simulator

A web "virtual observatory" that sits beside Star Tracker Pro in the Ai One / protolabsglobal ecosystem. Star Tracker shows where things are; Astro Sim takes you there.

Its own Next.js app inside the `cosmic-clock` monorepo, deployed as its own Vercel project. It shares no build with the Ai One app in the repo root (the root `tsconfig.json` and `eslint.config.mjs` exclude this folder).

> This Next.js version has breaking changes. Read `node_modules/next/dist/docs/` before changing framework-level code.

## Views

| Route | What | Badge |
| --- | --- | --- |
| `/moon` | three.js Moon, lat/lon grid, additive-blend reticle, "target lock" sound, HUD, 55 named targets | `ENHANCED` with a real map, `SIM` without |
| `/sun` | Latest NASA SDO frames as switchable lens filters | `LIVE` (falls back to a labelled `SIM` placeholder) |
| `/probe` | Venus / Jupiter atmosphere descent game | `SIM` |

Every view shows a `LIVE` / `ENHANCED` / `SIM` badge (`components/ModeBadge.tsx`). Never present a `SIM` view as an observation.

## Run

```bash
cd astro-simulator
npm install
npm run dev      # http://localhost:3100
npm run lint && npm run build && npm test
```

## Data status (read this)

- **`data/lunar-targets.json` is UNVERIFIED.** The build environment could not reach `planetarynames.wr.usgs.gov`, so the 55 rows were entered by hand and every row says `"status": "UNVERIFIED"`; the HUD repeats that warning. To verify: export the Moon from the IAU/USGS Gazetteer as CSV, then
  `node scripts/verify-targets.mjs gazetteer-moon.csv --write`. It checks lat/lon (0.6 deg) and diameter (5%), and flips matching rows to `VERIFIED`. The script was only exercised against a small synthetic CSV, not a real Gazetteer export.
- **No real Moon map is bundled** (NASA unreachable at build time). Put an equirectangular map (lon -180..180, centre = lon 0) at `public/textures/moon.jpg`, for example NASA SVS "CGI Moon Kit" or the LROC WAC mosaic, and the view switches from `SIM` to `ENHANCED`. Until then it draws a procedural stand-in.
- **Sun imagery** is loaded in the browser from `https://sdo.gsfc.nasa.gov/assets/img/latest/`. This was not testable from the build environment; the failure path (SIM placeholder) is the only one exercised.
- **Probe atmospheres** are smooth approximations tuned to headline figures (Venus 92 bar / 737 K at the surface; Jupiter about 22 bar / 429 K at 132 km below the 1-bar level). Game, not mission data.

## Coordinates

- Moon lat/lon (east positive) maps onto `SphereGeometry` UVs in `lib/astro/coords.ts`; `tests/coords.test.ts` checks it against real `SphereGeometry` vertex UVs.
- RA/Dec to alt/az uses local sidereal time (astronomy-engine) and the observer's latitude and longitude. It is not a sphere mapping. Cross-checked against astronomy-engine's own `Horizon`.
- The Moon opens facing the current sub-Earth point (libration).
- There is no JPL Horizons helper in the repo; ephemerides come from `astronomy-engine`, as in `lib/astronomy/ephemeris.ts` in the root app.

## Not in v1

Telescope hardware control. `lib/telescope/interface.ts` is an interface stub only (Web Bluetooth is unavailable on iOS Safari; mounts use Wi-Fi via ASCOM Alpaca or INDI).

## Deploy

Vercel project with **Root Directory = `astro-simulator`**, framework Next.js, domain `astrosim.protolabsglobal.com` (`CNAME astrosim -> cname.vercel-dns.com.`). No environment variables are required.
