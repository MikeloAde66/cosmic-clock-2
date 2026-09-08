import sqlite3 from 'sqlite3';
import { AlpacaAdapter } from '../hardware/alpaca.adapter.js';

const db = new sqlite3.Database('./src/db/messier.db');
const mount = new AlpacaAdapter();

export async function handleUserTargetIntent(targetQuery) {
  return new Promise((resolve, reject) => {
    // Query local database for target coordinates
    db.get(
      `SELECT * FROM messier_targets WHERE id = ? OR common_name LIKE ?`,
      [targetQuery.toUpperCase(), `%${targetQuery}%`],
      async (err, target) => {
        if (err || !target) {
          return resolve({ status: 'NOT_FOUND', message: `I couldn't locate ${targetQuery} in the local offline database.` });
        }

        try {
          // Command mount to move
          await mount.slewToTarget(target.ra_decimal, target.dec_decimal);
          resolve({
            status: 'SLEWING',
            targetName: target.common_name,
            ra: target.ra_decimal,
            dec: target.dec_decimal,
            info: target.description
          });
        } catch (slewError) {
          reject(`Hardware movement failed: ${slewError.message}`);
        }
      }
    );
  });
}
