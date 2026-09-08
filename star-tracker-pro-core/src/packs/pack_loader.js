import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = path.join(__dirname, 'available');

// Two flat registries, populated by loadPacks() below:
//  - targetRegistry: extra catalog targets a pack adds (same row shape as
//    deep_sky_targets), keyed by normalized id
//  - loreRegistry:   extra narrative lines a pack adds for a target id
//    (base catalog OR pack-added), keyed the same way
const targetRegistry = new Map();
const loreRegistry = new Map();
const loadedPackIds = [];
let loaded = false;

function normalizeId(id) {
  return String(id || '').replace(/\s+/g, '').toUpperCase();
}

// A pack is a JS module under packs/available/*.pack.js with a default
// export shaped like:
//   {
//     id: 'my-pack',                       // optional, defaults to filename
//     targets: [{ id, catalog, common_name, type, constellation,
//                 ra_decimal, dec_decimal, magnitude, description }, ...],
//     lore: { M42: ['...'], NGC7000: ['...', '...'] },
//   }
// Both `targets` and `lore` are optional — a pack can add just lore for
// existing targets, just new targets, or both.
function registerPack(pack, filename) {
  const packId = pack.id || filename;

  if (Array.isArray(pack.targets)) {
    for (const target of pack.targets) {
      if (!target || !target.id) continue;
      targetRegistry.set(normalizeId(target.id), target);
    }
  }

  if (pack.lore && typeof pack.lore === 'object') {
    for (const [id, lines] of Object.entries(pack.lore)) {
      const key = normalizeId(id);
      const existing = loreRegistry.get(key) || [];
      loreRegistry.set(key, existing.concat(Array.isArray(lines) ? lines : [lines]));
    }
  }

  loadedPackIds.push(packId);
}

// Scans packs/available/ once and merges every *.pack.js file found there.
// Malformed/broken packs are skipped with a warning rather than crashing
// the whole service — one bad pack shouldn't take down target routing.
export async function loadPacks() {
  if (loaded) return summary();
  loaded = true;

  if (!fs.existsSync(PACKS_DIR)) return summary();

  const files = fs.readdirSync(PACKS_DIR).filter((f) => f.endsWith('.pack.js'));
  for (const file of files) {
    try {
      const mod = await import(pathToFileURL(path.join(PACKS_DIR, file)).href);
      if (!mod.default || typeof mod.default !== 'object') {
        console.warn(`[pack_loader] Skipping ${file}: no default export.`);
        continue;
      }
      registerPack(mod.default, file);
    } catch (err) {
      console.error(`[pack_loader] Failed to load ${file}:`, err.message);
    }
  }

  return summary();
}

function summary() {
  return {
    packs: loadedPackIds.slice(),
    targetCount: targetRegistry.size,
    loreTargetCount: loreRegistry.size,
  };
}

// Same exact-id-or-fuzzy-name matching as catalogRepo.lookupCatalogTarget,
// so pack-added targets are reachable through voice queries exactly like
// built-in ones ("go to the Christmas Tree Cluster" works the same way as
// "go to the Orion Nebula").
export function getPackTarget(query) {
  const idKey = normalizeId(query);
  if (targetRegistry.has(idKey)) return targetRegistry.get(idKey);

  const needle = String(query || '').toLowerCase();
  if (!needle) return null;
  for (const target of targetRegistry.values()) {
    if (target.common_name && target.common_name.toLowerCase().includes(needle)) {
      return target;
    }
  }
  return null;
}

export function getPackLore(targetId) {
  return loreRegistry.get(normalizeId(targetId)) || [];
}

export function listLoadedPacks() {
  return loadedPackIds.slice();
}
