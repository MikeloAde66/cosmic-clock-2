import os

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from quantum_braket import run_quantum_circuit_simulation

app = FastAPI(
    title="Kali Quantum Circuit Service",
    description="Executes Amazon Braket circuits on a local simulator for Kali's quantum-tool integration.",
    version="1.0.0",
)

# Same permissive CORS as main.py (the existing Archive.org service) — this
# only ever gets called server-to-server from the Next.js API route, not
# directly from a browser, but matching the established pattern here.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# quantum_braket.run_quantum_circuit_simulation runs exec() on whatever
# circuit_code it's given — that's a real remote-code-execution primitive
# by design (it's how arbitrary Braket circuits get built from the model's
# output), so this endpoint must never be reachable without a shared
# secret. Set QUANTUM_SERVICE_API_KEY in this service's environment and
# the same value as QUANTUM_SERVICE_API_KEY on the Next.js/Vercel side.
API_KEY = os.environ.get("QUANTUM_SERVICE_API_KEY")


class CircuitRequest(BaseModel):
    circuit_code: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/run-circuit")
def run_circuit(payload: CircuitRequest, x_api_key: str | None = Header(default=None)):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return run_quantum_circuit_simulation(payload.circuit_code)
