import sys
import traceback
from typing import Any, Dict, Optional

from braket.circuits import Circuit
from braket.devices import LocalSimulator

# Rough, list-price-order-of-magnitude per-shot costs (USD) for a handful of
# real Braket QPUs, used only to give a human approver a ballpark before
# they approve real spend — NOT wired to AWS's actual current pricing API,
# which this service doesn't call. Verify against
# https://aws.amazon.com/braket/pricing/ before trusting this for a real
# budget decision; treat DEFAULT_PER_SHOT_USD as a conservative placeholder
# for any device not explicitly listed here (deliberately on the high side,
# so an unrecognized device errs toward "ask for a bigger sign-off," not
# the reverse). There's also a real per-task fee on top of per-shot cost
# for QPU (not simulator) devices that isn't accounted for here at all.
PER_SHOT_USD_BY_DEVICE_SUBSTRING = {
    "ionq": 0.03,
    "rigetti": 0.00035,
    "iqm": 0.00145,
    "sv1": 0.00075,  # on-demand simulator, not real QPU hardware
}
DEFAULT_PER_SHOT_USD = 0.05


def estimate_cost_usd(target_qpu: Optional[str], shots: int) -> float:
    if not target_qpu:
        return round(DEFAULT_PER_SHOT_USD * shots, 2)
    device_key = target_qpu.lower()
    for substring, per_shot in PER_SHOT_USD_BY_DEVICE_SUBSTRING.items():
        if substring in device_key:
            return round(per_shot * shots, 2)
    return round(DEFAULT_PER_SHOT_USD * shots, 2)


def run_quantum_circuit_simulation(
    circuit_code: str, target_qpu: Optional[str] = None, shots: int = 1000
) -> Dict[str, Any]:
    local_vars: Dict[str, Any] = {"Circuit": Circuit}
    try:
        exec(circuit_code, {}, local_vars)
        if "circuit" not in local_vars or not isinstance(local_vars["circuit"], Circuit):
            return {
                "status": "error",
                "message": "Validation Failed: Code did not define a valid 'circuit' object.",
            }

        target_circuit = local_vars["circuit"]
        device = LocalSimulator()
        task = device.run(target_circuit, shots=1000)
        result = task.result()

        # OpenQASM is what CreateQuantumTask's Action parameter needs for
        # ExecuteOnQpu in the Step Functions workflow to actually submit
        # this SAME validated circuit to real hardware, rather than a
        # separate, unvalidated copy of it. NOT verified against a real
        # device: most current Braket QPUs support OpenQASM3, but a few
        # older ones only accept the JAQCD format — check the specific
        # target device's supported action types before relying on this
        # for a real paid submission.
        circuit_ir = target_circuit.to_ir(ir_type="OPENQASM")

        return {
            "status": "success",
            "circuit_structure": str(target_circuit),
            "measurement_counts": dict(result.measurement_counts),
            "probabilities": {str(k): float(v) for k, v in result.measurement_probabilities.items()},
            # Added for aws/step-functions/kali-quantum-workflow.json's
            # RequestApproval state, which shows these to a human approver
            # before any real hardware spend happens.
            "qubit_count": target_circuit.qubit_count,
            "estimated_cost_usd": estimate_cost_usd(target_qpu, shots),
            "circuit_summary": f"{target_circuit.qubit_count}-qubit circuit, {shots} shots requested"
            + (f", target {target_qpu}" if target_qpu else ""),
            "circuit_action": circuit_ir.json(),
        }
    except Exception as e:
        exc_type, exc_value, exc_traceback = sys.exc_info()
        return {
            "status": "error",
            "message": f"Execution failed: {str(e)}",
            "traceback": "".join(traceback.format_exception(exc_type, exc_value, exc_traceback)),
        }
