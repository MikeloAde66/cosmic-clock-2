import sys
import traceback
from typing import Any, Dict

from braket.circuits import Circuit
from braket.devices import LocalSimulator


def run_quantum_circuit_simulation(circuit_code: str) -> Dict[str, Any]:
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

        return {
            "status": "success",
            "circuit_structure": str(target_circuit),
            "measurement_counts": dict(result.measurement_counts),
            "probabilities": {str(k): float(v) for k, v in result.measurement_probabilities.items()},
        }
    except Exception as e:
        exc_type, exc_value, exc_traceback = sys.exc_info()
        return {
            "status": "error",
            "message": f"Execution failed: {str(e)}",
            "traceback": "".join(traceback.format_exception(exc_type, exc_value, exc_traceback)),
        }
