import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('./src/db/catalog.db');

// Shared by kali_hardware_link.js and intent_router.js so the lookup query
// lives in one place. Spans Messier, NGC, and Caldwell targets (see
// init_catalog.sql) — a single unified table so "M42", "NGC 7000", and
// "the Double Cluster" all resolve through the same query.
//
// Uses node:sqlite (built into Node 22.5+) rather than the sqlite3 npm
// package — sqlite3's prebuilt native binding failed to load on Render
// with ERR_DLOPEN_FAILED (a build/runtime container mismatch). node:sqlite
// ships inside Node itself, so there's no native binary to mismatch.
// Still declared async, even though the body is synchronous, so the
// function's contract (a Promise) doesn't change for its callers, which
// already `await` it.
export async function lookupCatalogTarget(query) {
  // Users/voice input naturally include a space in catalog IDs ("NGC 7000"),
  // but the stored id has none ("NGC7000") — normalize for the exact-id
  // match while leaving the original (spaced) query for the name search.
  const idCandidate = query.replace(/\s+/g, '').toUpperCase();
  const row = db
    .prepare('SELECT * FROM deep_sky_targets WHERE id = ? OR common_name LIKE ?')
    .get(idCandidate, `%${query}%`);
  return row ?? null;
}
