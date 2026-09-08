// Regenerates catalog.db from init_catalog.sql. Run at build time (see
// package.json's "build" script and render.yaml's buildCommand) rather than
// relying on a committed .db file or a `sqlite3` CLI binary being present
// on the host — catalog.db is derived, read-only data, so rebuilding it
// fresh on every deploy is simpler than trying to persist it, especially
// on hosts (Render's free tier included) with an ephemeral filesystem.
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'src', 'db', 'catalog.db');
const SQL_PATH = path.join(__dirname, '..', 'src', 'db', 'init_catalog.sql');

const sql = fs.readFileSync(SQL_PATH, 'utf-8');
const db = new sqlite3.Database(DB_PATH);

db.exec(sql, (err) => {
  if (err) {
    console.error('[init-db] Failed to initialize catalog.db:', err.message);
    process.exit(1);
  }
  db.get('SELECT COUNT(*) AS count FROM deep_sky_targets', (countErr, row) => {
    if (countErr) {
      console.error('[init-db] catalog.db initialized but verification query failed:', countErr.message);
      process.exit(1);
    }
    console.log(`[init-db] catalog.db ready with ${row.count} targets.`);
    db.close();
  });
});
