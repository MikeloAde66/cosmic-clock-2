// Spins up the REAL server.js as a child process against a tiny mock Alpaca
// REST device (so slew/tracking calls actually succeed, not just fail
// gracefully) and drives it exactly like a real client would: REST calls +
// a live WebSocket. Uses node's built-in test runner — no new test-framework
// dependency, consistent with every prior phase in this workspace.
//
// Run with: npm test  (or: node --test tests/)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

const SERVER_PORT = 4501;
const MOCK_ALPACA_PORT = 4502;
const BASE_URL = `http://localhost:${SERVER_PORT}`;
const WS_URL = `ws://localhost:${SERVER_PORT}/ws/indi`;

let serverProcess;
let mockAlpacaServer;
// Mutable so individual tests can flip mount behavior mid-suite.
const alpacaState = { tracking: true, slewShouldFail: false };

function startMockAlpaca() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url.endsWith('/tracking') && req.method === 'GET') {
        res.end(JSON.stringify({ Value: alpacaState.tracking }));
        return;
      }
      if (req.url.endsWith('/slewtocoordinatesasync') && req.method === 'PUT') {
        res.end(
          JSON.stringify(
            alpacaState.slewShouldFail
              ? { ErrorNumber: 1, ErrorMessage: 'Simulated slew failure' }
              : { ErrorNumber: 0 }
          )
        );
        return;
      }
      if (req.url.endsWith('/abortslew') && req.method === 'PUT') {
        res.end(JSON.stringify({ ErrorNumber: 0 }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'not found', url: req.url }));
    });
    server.listen(MOCK_ALPACA_PORT, () => resolve(server));
  });
}

function startServer() {
  const child = spawn('node', ['src/server.js'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      ALPACA_HOST: '127.0.0.1',
      ALPACA_PORT: String(MOCK_ALPACA_PORT),
      ALPACA_DEVICE_NUMBER: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.stderr.write(`[server.js] ${d}`));
  return child;
}

async function waitForHealth(timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {
      // not listening yet — keep polling
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server.js did not become healthy within ${timeoutMs}ms`);
}

// Buffers every message from the moment the socket is created (not from
// whenever a test happens to attach a listener), so there's no race between
// "connect" and "the server's welcome message arrives."
function openSocket() {
  const ws = new WebSocket(WS_URL);
  const received = [];
  ws.on('message', (data) => received.push(JSON.parse(data.toString())));

  const ready = new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  async function waitForCount(n, timeoutMs = 5000) {
    const start = Date.now();
    while (received.length < n) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `Timed out waiting for ${n} WS message(s); got ${received.length}: ${JSON.stringify(received)}`
        );
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    return received.slice(0, n);
  }

  return { ws, ready, received, waitForCount };
}

async function postIntent(query) {
  const res = await fetch(`${BASE_URL}/api/voice/intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  mockAlpacaServer = await startMockAlpaca();
  serverProcess = startServer();
  await waitForHealth();
});

after(async () => {
  serverProcess?.kill();
  await new Promise((resolve) => mockAlpacaServer.close(resolve));
});

// ---------- full mount slew cycle ----------

test('slew cycle: GOTO a known target succeeds and streams the right stages in order', async () => {
  alpacaState.slewShouldFail = false;
  const sock = openSocket();
  await sock.ready;
  await sock.waitForCount(1); // the initial "connected" ack

  const { status, body } = await postIntent('go to M42');
  assert.equal(status, 200);
  assert.equal(body.status, 'SLEWING');
  assert.equal(body.targetName, 'Orion Nebula');

  const messages = await sock.waitForCount(4); // connected, searching, target_found, complete
  assert.deepEqual(
    messages.map((m) => m.stage || m.type),
    ['connected', 'searching', 'target_found', 'complete']
  );

  sock.ws.close();
});

test('slew cycle: a real hardware slew failure surfaces as ERROR, not a silent success', async () => {
  alpacaState.slewShouldFail = true;
  const { body } = await postIntent('go to M31');
  assert.equal(body.status, 'ERROR');
  assert.match(body.message, /Simulated slew failure/);
  alpacaState.slewShouldFail = false;
});

test('slew cycle: an unknown target never reaches the mount at all', async () => {
  const { body } = await postIntent('go to the Sombrero Galaxy');
  assert.equal(body.status, 'NOT_FOUND');
});

test('slew cycle: abort stops the mount', async () => {
  const res = await fetch(`${BASE_URL}/api/mount/abort`, { method: 'POST' });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.status, 'STOPPED');
});

// ---------- status polling ----------

test('status polling: REST endpoint reflects the mount\'s actual tracking state', async () => {
  alpacaState.tracking = true;
  let res = await fetch(`${BASE_URL}/api/mount/tracking`);
  assert.equal((await res.json()).tracking, true);

  alpacaState.tracking = false;
  res = await fetch(`${BASE_URL}/api/mount/tracking`);
  assert.equal((await res.json()).tracking, false);
});

test('status polling: voice STATUS intent agrees with REST, over both the HTTP response and the WS stream', async () => {
  alpacaState.tracking = true;
  const sock = openSocket();
  await sock.ready;
  await sock.waitForCount(1);

  const { body } = await postIntent('are you tracking');
  assert.equal(body.status, 'STATUS');
  assert.equal(body.tracking, true);

  const messages = await sock.waitForCount(3); // connected, checking_status, status
  const statusEvent = messages.find((m) => m.stage === 'status');
  assert.equal(statusEvent.tracking, true);

  sock.ws.close();
});

// ---------- WebSocket reconnection failover ----------

test('WS failover: an abruptly dropped client does not break the server for the next one', async () => {
  const first = openSocket();
  await first.ready;
  await first.waitForCount(1);
  first.ws.terminate(); // abrupt drop (not a clean close), the case that matters

  // Give the server a beat to notice the dead socket before leaning on that.
  await new Promise((r) => setTimeout(r, 300));

  const second = openSocket();
  await second.ready;
  await second.waitForCount(1);

  const { status } = await postIntent('stop');
  assert.equal(status, 200);

  const messages = await second.waitForCount(2); // connected, then a real broadcast
  assert.equal(messages[0].type, 'connected');
  assert.equal(messages[1].stage, 'stopping');

  second.ws.close();
});

test('WS failover: the server survives repeated connect/disconnect cycles', async () => {
  for (let i = 0; i < 5; i++) {
    const sock = openSocket();
    await sock.ready;
    await sock.waitForCount(1);
    sock.ws.close();
  }
  // If any prior cycle had crashed the server, this fails.
  const res = await fetch(`${BASE_URL}/health`);
  assert.equal(res.status, 200);
});
