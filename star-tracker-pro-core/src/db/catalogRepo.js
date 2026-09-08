import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./src/db/catalog.db');

// Shared by kali_hardware_link.js and intent_router.js so the lookup query
// lives in one place. Spans Messier, NGC, and Caldwell targets (see
// init_catalog.sql) — a single unified table so "M42", "NGC 7000", and
// "the Double Cluster" all resolve through the same query.
export function lookupCatalogTarget(query) {
  // Users/voice input naturally include a space in catalog IDs ("NGC 7000"),
  // but the stored id has none ("NGC7000") — normalize for the exact-id
  // match while leaving the original (spaced) query for the name search.
  const idCandidate = query.replace(/\s+/g, '').toUpperCase();
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM deep_sky_targets WHERE id = ? OR common_name LIKE ?`,
      [idCandidate, `%${query}%`],
      (err, row) => {
        if (err) return reject(err);
        resolve(row ?? null);
      }
    );
  });
}
