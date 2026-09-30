"""Original, bounded DC-link RLC transient teaching model (SI internally).

An ideal DC source drives series R-L, then parallel C and a resistive load.
RK4 integrates current, voltage and three energy ledgers together. Source
events fall on integration boundaries; plotting samples are a separate clock.
This is not a switching-converter or PSCAD/EMTDC equivalent.
"""

import argparse
from decimal import Decimal
import json
import math
from pathlib import Path

from .contracts import InputError

DEFAULT_EMT = {
    "source_v": 800,
    "resistance_ohm": 0.08,
    "inductance_mh": 0.6,
    "capacitance_mf": 12,
    "load_ohm": 12.8,
    "sag_pu": 0.5,
    "sag_start_ms": 40,
    "sag_duration_ms": 80,
    "duration_ms": 200,
    "step_us": 20,
}
EMT_LIMITS = {
    "source_v": (400, 1000),
    "resistance_ohm": (0.02, 1),
    "inductance_mh": (0.1, 5),
    "capacitance_mf": (1, 50),
    "load_ohm": (2, 50),
    "sag_pu": (0.1, 1),
    "sag_start_ms": (10, 80),
    "sag_duration_ms": (5, 100),
    "duration_ms": (200, 300),
    "step_us": (5, 50),
}
EMT_PRESETS = {
    "voltage-sag": dict(DEFAULT_EMT),
    "short-dip": {**DEFAULT_EMT, "sag_pu": 0.4, "sag_duration_ms": 10},
    "buffered-bus": {**DEFAULT_EMT, "capacitance_mf": 24},
    "recovery-ringing": {**DEFAULT_EMT, "resistance_ohm": 0.02, "capacitance_mf": 4},
}
ASSUMPTIONS = [
    "Ideal DC-equivalent source; linear series R-L and shunt C with a constant-resistance load.",
    "Initial state is the pre-sag DC steady state; source step events are right-continuous.",
    "No rectifier, switching devices, UPS controller, protection, AC network or thermal model.",
    "Signed source energy includes reverse flow into the ideal source; no reverse-blocking diode.",
    "The ideal capacitor permits negative voltage; nonlinear voltage clamps and device limits are absent.",
    "Authored teaching parameters, not a calibrated facility or a PSCAD/EMTDC reproduction.",
    "RK4 integration; 100 us output sampling. Reported extrema are integration-endpoint samples.",
]


def validate_config(config: dict) -> dict:
    """Reject ambiguous units, nonfinite numbers and unbounded computation."""
    if not isinstance(config, dict) or set(config) != set(DEFAULT_EMT):
        raise InputError("EMT config must contain exactly the documented ten fields")
    for field, (low, high) in EMT_LIMITS.items():
        value = config[field]
        if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
            raise InputError(f"{field} must be a finite number")
        numeric = float(value)
        if not math.isfinite(numeric) or not low <= numeric <= high:
            raise InputError(f"{field} must be between {low} and {high}")
    for field in ("sag_start_ms", "sag_duration_ms", "duration_ms"):
        if config[field] != int(config[field]):
            raise InputError(f"{field} must be a whole number of milliseconds")
    if config["step_us"] not in (5, 10, 20, 25, 50):
        raise InputError("step_us must be one of 5, 10, 20, 25, 50")
    if config["sag_start_ms"] + config["sag_duration_ms"] >= config["duration_ms"]:
        raise InputError("The sag must clear before the study ends")
    # The shared JSON parser uses Decimal for fractional tokens; this ODE uses
    # IEEE-754 doubles in both runtimes, explicitly converted at its boundary.
    return {
        key: int(value) if isinstance(value, int) else float(value) for key, value in config.items()
    }


def simulate_emt(config: dict | None = None) -> dict:
    """Return a deterministic complete study, including reproducible inputs."""
    config = validate_config(DEFAULT_EMT if config is None else config)
    nominal, resistance, load = (config[k] for k in ("source_v", "resistance_ohm", "load_ohm"))
    inductance = config["inductance_mh"] / 1000
    capacitance = config["capacitance_mf"] / 1000
    step_us = int(config["step_us"])
    dt = step_us / 1_000_000
    start_us = int(config["sag_start_ms"] * 1000)
    clear_us = int((config["sag_start_ms"] + config["sag_duration_ms"]) * 1000)
    steps = int(config["duration_ms"] * 1000 / step_us)
    initial_current = nominal / (resistance + load)
    initial_voltage = load * initial_current
    # State order: source current, bus voltage, source/loss/load energy.
    state = [initial_current, initial_voltage, 0.0, 0.0, 0.0]

    def stored(current: float, voltage: float) -> float:
        return 0.5 * inductance * current * current + 0.5 * capacitance * voltage * voltage

    initial_energy = stored(initial_current, initial_voltage)

    def source(time_us: int) -> float:
        return nominal * config["sag_pu"] if start_us <= time_us < clear_us else nominal

    def derivative(values: list[float], voltage_source: float) -> list[float]:
        current, voltage = values[:2]
        return [
            (voltage_source - resistance * current - voltage) / inductance,
            (current - voltage / load) / capacitance,
            voltage_source * current,
            resistance * current * current,
            voltage * voltage / load,
        ]

    minimum = initial_voltage
    peak_current = abs(initial_current)
    recovery_peak = -math.inf
    rows = []
    for index in range(steps + 1):
        time_us = index * step_us
        current, voltage, supplied, lost, consumed = state
        minimum = min(minimum, voltage)
        peak_current = max(peak_current, abs(current))
        if time_us >= clear_us:
            recovery_peak = max(recovery_peak, voltage)
        if time_us % 100 == 0:
            energy = stored(current, voltage)
            rows.append(
                {
                    "time_ms": time_us / 1000,
                    "source_v": source(time_us),
                    "bus_v": voltage,
                    "source_a": current,
                    "load_a": voltage / load,
                    "stored_j": energy,
                    "balance_error_j": supplied - lost - consumed - (energy - initial_energy),
                }
            )
        if index == steps:
            break
        # Keep the left-interval source through all four stages. The next
        # interval applies an event; no RK stage smears a discontinuity.
        voltage_source = source(time_us)
        k1 = derivative(state, voltage_source)
        k2 = derivative([a + dt * b / 2 for a, b in zip(state, k1)], voltage_source)
        k3 = derivative([a + dt * b / 2 for a, b in zip(state, k2)], voltage_source)
        k4 = derivative([a + dt * b for a, b in zip(state, k3)], voltage_source)
        state = [
            value + dt * (a + 2 * b + 2 * c + d) / 6
            for value, a, b, c, d in zip(state, k1, k2, k3, k4)
        ]
    final_energy = stored(state[0], state[1])
    return {
        "model": "dc-link-rlc-v1",
        "config": config,
        "sample_step_us": 100,
        "assumptions": list(ASSUMPTIONS),
        "rows": rows,
        "summary": {
            "initial_bus_v": initial_voltage,
            "minimum_bus_v": minimum,
            "peak_source_a": peak_current,
            "recovery_peak_v": recovery_peak,
            "source_energy_j": state[2],
            "resistor_loss_j": state[3],
            "load_energy_j": state[4],
            "initial_stored_j": initial_energy,
            "final_stored_j": final_energy,
            "balance_error_j": state[2] - state[3] - state[4] - (final_energy - initial_energy),
        },
    }


def main() -> None:
    from .output import write_result

    parser = argparse.ArgumentParser(
        description="DC-link transient teaching study; no physical control"
    )
    inputs = parser.add_mutually_exclusive_group()
    inputs.add_argument("--preset", choices=tuple(EMT_PRESETS), default="voltage-sag")
    inputs.add_argument(
        "--config", type=Path, help="JSON containing exactly the ten study input fields"
    )
    parser.add_argument("--output", type=Path)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    try:
        if args.force and not args.output:
            raise InputError("--force requires --output")
        config = (
            json.loads(args.config.read_text(encoding="utf-8"))
            if args.config
            else EMT_PRESETS[args.preset]
        )
        result = simulate_emt(config)
        content = json.dumps(result, indent=2, allow_nan=False) + "\n"
        if args.output:
            write_result(
                args.output,
                content,
                protected_paths=[args.config] if args.config else [],
                force=args.force,
            )
            print(f"Saved EMT teaching study: {args.output}")
        else:
            print(content, end="")
    except (InputError, OSError, ValueError) as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
