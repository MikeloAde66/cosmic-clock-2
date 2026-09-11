import dgram from 'node:dgram';
import type { DiscoveredAlpacaServer } from '@/lib/starTrackerPro/alpaca/types';

// Real ASCOM Alpaca discovery protocol (UDP broadcast on port 32227,
// ASCII payload "alpacadiscovery1", responders reply with JSON
// {"AlpacaPort": <port>}) — this HAS to live server-side. Browsers have no
// raw UDP socket API at all (no dgram equivalent in any browser JS
// runtime), so client-side "auto-discovery" as literally described isn't
// achievable no matter how it's written; this Next.js API route runs in a
// real Node.js runtime (see `runtime = 'nodejs'` below) and does the real
// UDP work, exposed to the browser as a plain HTTP endpoint it can poll.
export const runtime = 'nodejs';

const ALPACA_DISCOVERY_PORT = 32227;
const DISCOVERY_MESSAGE = Buffer.from('alpacadiscovery1');
const LISTEN_WINDOW_MS = 2000;

interface AlpacaDiscoveryReply {
  AlpacaPort: number;
}

export async function GET() {
  const found: DiscoveredAlpacaServer[] = [];

  await new Promise<void>((resolve) => {
    const socket = dgram.createSocket('udp4');

    socket.on('message', (msg, rinfo) => {
      try {
        const parsed: AlpacaDiscoveryReply = JSON.parse(msg.toString('utf8'));
        if (typeof parsed.AlpacaPort === 'number') {
          found.push({ host: rinfo.address, alpacaPort: parsed.AlpacaPort });
        }
      } catch {
        // Not a real Alpaca discovery reply — ignore rather than guess.
      }
    });

    socket.on('error', () => {
      socket.close();
      resolve();
    });

    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(DISCOVERY_MESSAGE, ALPACA_DISCOVERY_PORT, '255.255.255.255');
      setTimeout(() => {
        socket.close();
        resolve();
      }, LISTEN_WINDOW_MS);
    });
  });

  return Response.json({ servers: found });
}
