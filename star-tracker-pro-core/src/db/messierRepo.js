import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./src/db/messier.db');

// Shared by kali_hardware_link.js and intent_router.js so the lookup query
// lives in one place.
export function lookupMessierTarget(query) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM messier_targets WHERE id = ? OR common_name LIKE ?`,
      [query.toUpperCase(), `%${query}%`],
      (err, row) => {
        if (err) return reject(err);
        resolve(row ?? null);
      }
    );
  });
}
