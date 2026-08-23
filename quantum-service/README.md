# Kali Quantum Circuit Service

A small standalone FastAPI service that runs Amazon Braket circuits on
`LocalSimulator`. This exists because the main app (`cosmic-clock`) deploys
to Vercel, whose Node.js serverless functions don't ship a Python
interpreter or `amazon-braket-sdk` — this service runs separately, and the
Next.js API route (`app/api/ai-one-chat/route.ts`) calls it over HTTP.

## Local run

```bash
cd quantum-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
QUANTUM_SERVICE_API_KEY=dev-only uvicorn main:app --reload --port 8080
```

`curl -X POST localhost:8080/run-circuit -H "Content-Type: application/json" -H "X-API-Key: dev-only" -d '{"circuit_code": "circuit = Circuit().h(0).cnot(0, 1)"}'`

## Deploying (Render)

This is a plain FastAPI + `requirements.txt` + `Procfile` app — deployable
to Render, Fly.io, Railway, or any host that runs a Python web service.
Render is the simplest for a small always-on service.

### Option A — Blueprint (`render.yaml`, recommended)

A `render.yaml` blueprint lives at the repo root and already declares this
service (`rootDir: quantum-service`, build/start commands, health check).

1. In the Render dashboard: **New → Blueprint**, connect this repo.
2. Render reads `render.yaml` and shows one service, `kali-quantum-service`.
3. It'll prompt for `QUANTUM_SERVICE_API_KEY` (left blank in the file on
   purpose — never commit a real secret). Set it to a real random value,
   e.g. `openssl rand -hex 32`.
4. Deploy. Note the service's public URL once it's live.

The blueprint uses the `starter` plan (~$7/mo, stays online 24/7 — no
cold-start spin-down). Switch it to `free` in the dashboard after deploying
if occasional cold starts are an acceptable tradeoff for $0/mo; the free
tier spins down after inactivity, so the first request after idle time can
take several seconds.

### Option B — Manual

1. Push this repo (or just this subdirectory) to a place Render can see it.
2. New Web Service → point Root Directory at `quantum-service/`.
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Set an environment variable `QUANTUM_SERVICE_API_KEY` to a real random
   secret (e.g. `openssl rand -hex 32`).
6. Once deployed, note the service's public URL.

## Wiring it into the real app

In the Vercel project (cosmic-clock), set these two environment variables
to the values from the deployed service:

- `QUANTUM_SERVICE_URL` — the service's public URL, no trailing slash
  (e.g. `https://kali-quantum.onrender.com`).
- `QUANTUM_SERVICE_API_KEY` — the same secret set on the service above.

Without `QUANTUM_SERVICE_URL` set, Kali's quantum tool returns a clear
"not configured" error to the model instead of failing silently or
throwing — the rest of Kali's chat keeps working normally either way.

Via the Vercel CLI, once you have the real Render URL and secret:

```bash
vercel env add QUANTUM_SERVICE_URL production
vercel env add QUANTUM_SERVICE_API_KEY production
vercel --prod   # redeploy so the new env vars take effect
```

## Security note

`run_quantum_circuit_simulation` executes the given Python code via
`exec()` — that's how it turns a model-authored Braket circuit into a real
`Circuit` object, but it also means this endpoint is a genuine remote code
execution primitive by design. Never deploy it without
`QUANTUM_SERVICE_API_KEY` set, and never point `QUANTUM_SERVICE_URL` at it
from anywhere other than the trusted server-side Next.js route.
