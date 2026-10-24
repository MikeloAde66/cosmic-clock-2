// Checks data/lunar-targets.json against an export of the IAU / USGS
// Gazetteer of Planetary Nomenclature (https://planetarynames.wr.usgs.gov,
// Target: Moon, "Download" -> CSV). Usage:
//   node scripts/verify-targets.mjs path/to/gazetteer-moon.csv [--write]
// Column names are matched loosely (feature name, center latitude/longitude,
// diameter). Longitudes in the export may be 0..360; they are normalised to
// (-180, 180]. Rows within TOL_DEG and (if both present) 5% diameter are
// marked VERIFIED with --write; anything else is reported and left alone.
import fs from 'node:fs';

const TOL_DEG = 0.6;
const [csvPath, ...flags] = process.argv.slice(2);
if (!csvPath) {
  console.error('usage: node scripts/verify-targets.mjs gazetteer.csv [--write]');
  process.exit(2);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
const col = (re) => header.findIndex((h) => re.test(h));
const iName = col(/^(clean)?feature(name)?$|^name$|^cleanfeaturename$/);
const iLat = col(/centerlat|^lat/);
const iLon = col(/centerlon|^lon/);
const iDiam = col(/diameter/);
if (iName < 0 || iLat < 0 || iLon < 0) {
  console.error('Could not find name/lat/lon columns in header:', rows[0].join(' | '));
  process.exit(2);
}
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const lon180 = (l) => ((((l + 180) % 360) + 360) % 360) - 180;
const ref = new Map(rows.slice(1).map((r) => [norm(r[iName]), r]));

const file = new URL('../data/lunar-targets.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
let ok = 0, bad = 0, missing = 0;
for (const t of data.targets) {
  const r = ref.get(norm(t.name.replace(/\s*\(.*\)$/, '')));
  if (!r) { console.log(`MISSING   ${t.name}`); missing++; continue; }
  const lat = parseFloat(r[iLat]);
  const lon = lon180(parseFloat(r[iLon]));
  const diam = iDiam >= 0 ? parseFloat(r[iDiam]) : NaN;
  const dLat = Math.abs(lat - t.latDeg);
  const dLon = Math.abs(lon180(lon - t.lonDeg));
  const diamBad = t.diameterKm != null && Number.isFinite(diam) && Math.abs(diam - t.diameterKm) / diam > 0.05;
  if (dLat > TOL_DEG || dLon > TOL_DEG || diamBad) {
    console.log(`MISMATCH  ${t.name}: have ${t.latDeg}, ${t.lonDeg}, ${t.diameterKm} km; Gazetteer ${lat}, ${lon}, ${diam} km`);
    bad++;
    if (flags.includes('--write')) { t.gazetteer = { latDeg: lat, lonDeg: lon, diameterKm: diam }; }
  } else {
    ok++;
    if (flags.includes('--write')) { t.status = 'VERIFIED'; t.latDeg = +lat.toFixed(2); t.lonDeg = +lon.toFixed(2); if (Number.isFinite(diam)) t.diameterKm = diam; }
  }
}
console.log(`${ok} match, ${bad} mismatch, ${missing} not found of ${data.targets.length}`);
if (flags.includes('--write')) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log('wrote data/lunar-targets.json');
}
