// Regenerates catalog.db from init_catalog.sql. Run at build time (see
// package.json's "build" script and render.yaml's buildCommand) rather than
// relying on a committed .db file — catalog.db is derived, read-only
// reference data, so rebuilding it fresh on every deploy is simpler than
// trying to persist it, especially on hosts (Render's free tier included)
// with an ephemeral filesystem.
//
// Uses node:sqlite (built into Node 22.5+), not the sqlite3 npm package —
// see catalogRepo.js for why.
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'src', 'db', 'catalog.db');
const SQL_PATH = path.join(__dirname, '..', 'src', 'db', 'init_catalog.sql');

const sql = fs.readFileSync(SQL_PATH, 'utf-8');
const db = new DatabaseSync(DB_PATH);

db.exec(sql);
const { count } = db.prepare('SELECT COUNT(*) AS count FROM deep_sky_targets').get();
console.log(`[init-db] catalog.db ready with ${count} targets.`);
db.close();
