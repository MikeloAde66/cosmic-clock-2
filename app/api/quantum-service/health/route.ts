// Server-side proxy for SystemMetricsGauges' latency gauge. QUANTUM_SERVICE_URL
// is server-only (same var app/api/ai-one-chat/route.ts already reads for the
// real run_quantum_circuit tool) — the client can't read it directly, and
// shouldn't be making a cross-origin call straight to an internal
// microservice's real URL anyway. This measures a real round trip to
// quantum-service's actual /health route (quantum-service/main.py:46), not a
// fabricated number.
export async function GET() {
  const serviceUrl = process.env.QUANTUM_SERVICE_URL;
  if (!serviceUrl) {
    return Response.json({ ok: false, latencyMs: null, reason: 'not_configured' });
  }

  const start = Date.now();
  try {
    const res = await fetch(`${serviceUrl}/health`, { signal: AbortSignal.timeout(5000) });
    const latencyMs = Date.now() - start;
    return Response.json({ ok: res.ok, latencyMs });
  } catch {
    // Real attempt, real failure — null, not a fabricated worst-case number.
    return Response.json({ ok: false, latencyMs: null, reason: 'unreachable' });
  }
}
