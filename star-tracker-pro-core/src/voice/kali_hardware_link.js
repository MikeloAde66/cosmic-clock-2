import { AlpacaAdapter } from '../hardware/alpaca.adapter.js';
import { lookupCatalogTarget } from '../db/catalogRepo.js';

const mount = new AlpacaAdapter();

export async function handleUserTargetIntent(targetQuery) {
  const target = await lookupCatalogTarget(targetQuery);
  if (!target) {
    return { status: 'NOT_FOUND', message: `I couldn't locate ${targetQuery} in the local offline database.` };
  }

  try {
    await mount.slewToTarget(target.ra_decimal, target.dec_decimal);
    return {
      status: 'SLEWING',
      targetName: target.common_name,
      ra: target.ra_decimal,
      dec: target.dec_decimal,
      info: target.description,
    };
  } catch (slewError) {
    throw new Error(`Hardware movement failed: ${slewError.message}`);
  }
}
