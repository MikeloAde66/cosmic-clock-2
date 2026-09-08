import 'dotenv/config';
import http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { AlpacaAdapter } from './hardware/alpaca.adapter.js';
import { routeIntent } from './voice/intent_router.js';

const PORT = process.env.PORT || 4000;

const mount = new AlpacaAdapter(
  process.env.ALPACA_HOST || '127.0.0.1',
  Number(process.env.ALPACA_PORT) || 11111,
  Number(process.env.ALPACA_DEVICE_NUMBER) || 0
);

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ---------- Alpaca REST endpoints ----------

app.get('/api/mount/tracking', async (_req, res) => {
  try {
    const tracking = await mount.getTrackingStatus();
    res.json({ tracking });
  } catch (err) {
    res.status(502).json({ error: `Could not reach Alpaca mount: ${err.message}` });
  }
});

app.post('/api/mount/slew', async (req, res) => {
  const { ra, dec } = req.body ?? {};
  if (typeof ra !== 'number' || typeof dec !== 'number') {
    return res.status(400).json({ error: 'Body must include numeric ra (hours) and dec (degrees).' });
  }
  try {
    const result = await mount.slewToTarget(ra, dec);
    res.json({ status: 'SLEWING', ra, dec, result });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/mount/abort', async (_req, res) => {
  try {
    await mount.emergencyStop();
    res.json({ status: 'STOPPED' });
  } catch (err) {
    res.status(502).json({ error: `Could not reach Alpaca mount: ${err.message}` });
  }
});

// ---------- Voice intent endpoint ----------

app.post('/api/voice/intent', async (req, res) => {
  const { query } = req.body ?? {};
  if (typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Body must include a non-empty string "query".' });
  }
  try {
    const result = await routeIntent(query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Telemetry ingestion + broadcast ----------
// indi_listener.py POSTs each parsed INDI XML event here as it streams in,
// and intent_router.js POSTs stage-by-stage voice/status events as it
// drives the Alpaca adapter — both fan out to every connected WebSocket
// client. Kept as a plain HTTP hop (rather than a direct process pipe/
// socket) so the Python and Node sides stay independently runnable/
// testable.
app.post('/api/telemetry/indi', (req, res) => {
  broadcast('indi_telemetry', req.body ?? {});
  res.status(202).json({ received: true });
});

app.post('/api/telemetry/voice', (req, res) => {
  broadcast('voice_status', req.body ?? {});
  res.status(202).json({ received: true });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/indi' });

function broadcast(type, event) {
  const payload = JSON.stringify({ type, ...event, ts: Date.now() });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', message: 'Subscribed to INDI + voice telemetry.' }));
});

server.listen(PORT, () => {
  console.log(`[star-tracker-pro-core] REST + WS server listening on port ${PORT}`);
  console.log(`  REST:      http://localhost:${PORT}/api/mount/...`);
  console.log(`  WebSocket: ws://localhost:${PORT}/ws/indi`);
});
