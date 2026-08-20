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

## Deploying

This is a plain FastAPI + `requirements.txt` + `Procfile` app — deployable
to Render, Fly.io, Railway, or any host that runs a Python web service.
Render is the simplest for a small always-on service:

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

## Security note

`run_quantum_circuit_simulation` executes the given Python code via
`exec()` — that's how it turns a model-authored Braket circuit into a real
`Circuit` object, but it also means this endpoint is a genuine remote code
execution primitive by design. Never deploy it without
`QUANTUM_SERVICE_API_KEY` set, and never point `QUANTUM_SERVICE_URL` at it
from anywhere other than the trusted server-side Next.js route.
