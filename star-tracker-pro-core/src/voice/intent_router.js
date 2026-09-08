import { AlpacaAdapter } from '../hardware/alpaca.adapter.js';
import { lookupMessierTarget } from '../db/messierRepo.js';

const mount = new AlpacaAdapter(
  process.env.ALPACA_HOST || '127.0.0.1',
  Number(process.env.ALPACA_PORT) || 11111,
  Number(process.env.ALPACA_DEVICE_NUMBER) || 0
);

const VOICE_EVENTS_URL =
  process.env.VOICE_EVENTS_URL || `http://localhost:${process.env.PORT || 4000}/api/telemetry/voice`;

const STOP_WORDS = /^(stop|abort|halt|cancel|emergency stop)\b/i;
const STATUS_WORDS = /^(status|what'?s your status|tracking status|are you tracking|where are (we|you( pointed)?))\b/i;
const GOTO_PREFIXES = [
  /^(go\s*to|point\s+(the\s+telescope\s+)?at|point\s+at|slew\s+to|show\s+me|find|locate|take\s+me\s+to|look\s+at)\s+/i,
];

// Rule-based, not a real NLP model — good enough for a fixed local catalog
// of target names/IDs. Recognizes a stop/status command up front, otherwise
// strips a leading verb phrase ("go to", "slew to", "point at", ...) and
// treats whatever remains as the target name/ID to look up.
export function parseIntent(rawText) {
  const text = (rawText || '').trim();

  if (STOP_WORDS.test(text)) return { type: 'STOP', raw: text };
  if (STATUS_WORDS.test(text)) return { type: 'STATUS', raw: text };

  let target = text;
  for (const prefix of GOTO_PREFIXES) {
    if (prefix.test(target)) {
      target = target.replace(prefix, '').trim();
      break;
    }
  }
  target = target.replace(/^the\s+/i, '').replace(/[.?!]+$/, '').trim();

  if (!target) return { type: 'UNKNOWN', raw: text };
  return { type: 'GOTO', target, raw: text };
}

async function publishVoiceEvent(event) {
  try {
    await fetch(VOICE_EVENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch (err) {
    // Best-effort, same as the INDI listener's telemetry posts — a dropped
    // status update shouldn't fail the underlying hardware command.
    console.error('[intent_router] Could not publish voice event:', err.message);
  }
}

async function handleStop() {
  await publishVoiceEvent({ stage: 'stopping', message: 'Stopping the mount.' });
  try {
    await mount.emergencyStop();
    const message = 'Mount stopped.';
    await publishVoiceEvent({ stage: 'stopped', message });
    return { status: 'STOPPED', message };
  } catch (err) {
    const message = `Could not stop the mount: ${err.message}`;
    await publishVoiceEvent({ stage: 'error', message });
    return { status: 'ERROR', message };
  }
}

async function handleStatus() {
  await publishVoiceEvent({ stage: 'checking_status', message: 'Checking tracking status.' });
  try {
    const tracking = await mount.getTrackingStatus();
    const message = tracking ? 'The mount is currently tracking.' : 'The mount is not tracking.';
    await publishVoiceEvent({ stage: 'status', message, tracking });
    return { status: 'STATUS', tracking, message };
  } catch (err) {
    const message = `Could not read mount status: ${err.message}`;
    await publishVoiceEvent({ stage: 'error', message });
    return { status: 'ERROR', message };
  }
}

async function handleGoto(targetQuery) {
  await publishVoiceEvent({ stage: 'searching', message: `Looking up ${targetQuery} in the local catalog...` });

  const target = await lookupMessierTarget(targetQuery);
  if (!target) {
    const message = `I couldn't find "${targetQuery}" in the local offline catalog.`;
    await publishVoiceEvent({ stage: 'not_found', message });
    return { status: 'NOT_FOUND', message };
  }

  await publishVoiceEvent({
    stage: 'target_found',
    message: `Found ${target.common_name}. Slewing now.`,
    target: target.common_name,
    ra: target.ra_decimal,
    dec: target.dec_decimal,
  });

  try {
    await mount.slewToTarget(target.ra_decimal, target.dec_decimal);
    const message = `Slewing to ${target.common_name}.`;
    await publishVoiceEvent({ stage: 'complete', message, target: target.common_name });
    return {
      status: 'SLEWING',
      targetName: target.common_name,
      ra: target.ra_decimal,
      dec: target.dec_decimal,
      info: target.description,
      message,
    };
  } catch (err) {
    const message = `Hardware movement failed: ${err.message}`;
    await publishVoiceEvent({ stage: 'error', message });
    return { status: 'ERROR', message };
  }
}

// Entry point: parse a raw voice/text query, drive the Alpaca adapter, and
// stream stage-by-stage speech/status events to the WebSocket server as it
// goes (not just a single result at the end).
export async function routeIntent(rawText) {
  const intent = parseIntent(rawText);

  switch (intent.type) {
    case 'STOP':
      return handleStop();
    case 'STATUS':
      return handleStatus();
    case 'GOTO':
      return handleGoto(intent.target);
    default: {
      const message = `I didn't catch a target in "${rawText}" — try something like "go to the Orion Nebula."`;
      await publishVoiceEvent({ stage: 'error', message });
      return { status: 'UNKNOWN', message };
    }
  }
}
