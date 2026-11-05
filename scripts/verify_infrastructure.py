"""Independently recompute the Infrastructure Engineering golden cases."""

from __future__ import annotations

import json
import math
import shutil
import subprocess
import sys
from pathlib import Path
from typing import TypedDict

ROOT = Path(__file__).resolve().parents[1]
CASES_PATH = ROOT / "data" / "infrastructure" / "golden-cases.json"
NODE_RESOLVER = ROOT / "apps" / "web" / "tests-engine" / "resolve-loader.mjs"


class GoldenCase(TypedDict):
    id: str
    model: str
    inputs: dict[str, object]
    expected: dict[str, object]


class BrowserResult(TypedDict):
    id: str
    result: dict[str, object]


def numeric_input(values: dict[str, object], field: str) -> int | float:
    """Preserve numeric representation while rejecting ambiguous fixture values."""
    value = values[field]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{field}: expected a finite real number")
    if not math.isfinite(value):
        raise ValueError(f"{field}: expected a finite real number")
    return value


def numeric_sequence(values: dict[str, object], field: str) -> list[int | float]:
    """Keep the supplied summation order and native int/float arithmetic."""
    value = values[field]
    if not isinstance(value, list):
        raise ValueError(f"{field}: expected an array of finite real numbers")
    return [numeric_input({field: element}, field) for element in value]


def object_record(value: object, name: str) -> dict[str, object]:
    if not isinstance(value, dict) or any(not isinstance(key, str) for key in value):
        raise ValueError(f"{name}: expected an object with string field names")
    return dict(value)


def golden_cases(value: object) -> list[GoldenCase]:
    if not isinstance(value, list):
        raise ValueError("Golden cases must be an array")
    cases: list[GoldenCase] = []
    for item in value:
        case = object_record(item, "golden case")
        case_id, model = case.get("id"), case.get("model")
        if not isinstance(case_id, str) or not isinstance(model, str):
            raise ValueError("Golden case id and model must be strings")
        cases.append(
            {
                "id": case_id,
                "model": model,
                "inputs": object_record(case.get("inputs"), "golden inputs"),
                "expected": object_record(case.get("expected"), "golden expected values"),
            }
        )
    return cases


def browser_results(value: object) -> list[BrowserResult]:
    if not isinstance(value, list):
        raise ValueError("Browser results must be an array")
    results: list[BrowserResult] = []
    for item in value:
        row = object_record(item, "browser result")
        case_id = row.get("id")
        if not isinstance(case_id, str):
            raise ValueError("Browser result id must be a string")
        results.append(
            {
                "id": case_id,
                "result": object_record(row.get("result"), "browser result values"),
            }
        )
    return results


def expected(model: str, p: dict[str, object]) -> dict[str, object]:
    if model == "loadLedger":
        it = (
            numeric_input(p, "racks")
            * numeric_input(p, "rackKW")
            * numeric_input(p, "demandFactor")
            * (1 + numeric_input(p, "growth"))
        )
        facility = it * numeric_input(p, "designRatio")
        residual = facility - it - numeric_input(p, "coolingKW")
        return {
            "itKW": it,
            "facilityKW": facility,
            "residualKW": residual,
            "apparentKVA": facility / numeric_input(p, "pf"),
            "lineA": facility
            / numeric_input(p, "pf")
            / math.sqrt(3)
            / numeric_input(p, "voltageKV"),
            "status": "screen-satisfied" if residual >= 0 else "screen-failed",
        }
    if model == "capacityBank":
        unit = (
            numeric_input(p, "unitMW") * numeric_input(p, "derating") * numeric_input(p, "loading")
        )
        available = (numeric_input(p, "installed") - numeric_input(p, "unavailable")) * unit
        margin = available - numeric_input(p, "requiredMW")
        return {
            "usableUnitMW": unit,
            "availableMW": available,
            "marginMW": margin,
            "minimumNPlusOne": math.ceil(numeric_input(p, "requiredMW") / unit) + 1,
            "status": "screen-satisfied" if margin >= 0 else "screen-failed",
        }
    if model == "transformerScreen":
        base = numeric_input(p, "voltageV") ** 2 / (numeric_input(p, "mva") * 1e6)
        transformer = numeric_input(p, "zPercent") / 100 * base
        source = (
            0
            if p["sourceMVA"] is None
            else numeric_input(p, "voltageV") ** 2 / (numeric_input(p, "sourceMVA") * 1e6)
        )
        return {
            "fullLoadA": numeric_input(p, "mva")
            * 1e6
            / math.sqrt(3)
            / numeric_input(p, "voltageV"),
            "baseOhm": base,
            "transformerOhm": transformer,
            "sourceOhm": source,
            "faultKA": numeric_input(p, "voltageV") / math.sqrt(3) / (transformer + source) / 1000,
        }
    if model == "storageScreen":
        ac = numeric_input(p, "acKW") * numeric_input(p, "minutes") / 60
        delivered = ac / numeric_input(p, "efficiency")
        return {
            "acKWh": ac,
            "deliveredDcKWh": delivered,
            "nominalKWh": delivered
            / numeric_input(p, "dischargeFraction")
            / numeric_input(p, "retainedAgeFraction"),
            "dcA": numeric_input(p, "acKW")
            * 1000
            / numeric_input(p, "efficiency")
            / numeric_input(p, "minDcV"),
        }
    if model == "inverseTime":
        multiple = numeric_input(p, "multiple")
        trip = (
            None
            if multiple <= 1
            else 0.14 * numeric_input(p, "tms") / math.expm1(0.02 * math.log(multiple))
        )
        return {
            "tripS": trip,
            "status": "outside-trip-domain" if trip is None else "model-evaluated",
        }
    if model == "auxiliaryScreen":
        return {
            "thdPercent": 100 * numeric_input(p, "harmonicA") / numeric_input(p, "fundamentalA"),
            "tddPercent": 100 * numeric_input(p, "harmonicA") / numeric_input(p, "referenceA"),
            "groundPotentialRiseV": numeric_input(p, "groundA") * numeric_input(p, "groundOhm"),
            "dcDropV": 2
            * numeric_input(p, "dcA")
            * numeric_input(p, "oneWayM")
            * numeric_input(p, "ohmPerM"),
        }
    if model == "thermalScreen":
        liquid = numeric_input(p, "rackKW") * numeric_input(p, "captureFraction")
        air = numeric_input(p, "rackKW") - liquid
        net = numeric_input(p, "heatMW") - numeric_input(p, "removedMW")
        return {
            "liquidKW": liquid,
            "residualAirKW": air,
            "waterKgS": liquid
            * 1000
            / numeric_input(p, "waterCp")
            / numeric_input(p, "waterDeltaK"),
            "residualAirM3S": air
            * 1000
            / numeric_input(p, "airDensity")
            / numeric_input(p, "airCp")
            / numeric_input(p, "airDeltaK"),
            "temperatureRiseKS": net / numeric_input(p, "capacitanceMJK"),
            "thermalLimitS": numeric_input(p, "capacitanceMJK") * numeric_input(p, "deltaK") / net
            if net > 0
            else None,
            "status": "finite-lumped-limit" if net > 0 else "no-rise-in-lumped-model",
        }
    if model == "networkScreen":
        loss = (
            numeric_input(p, "lengthM") / 1000 * numeric_input(p, "dbPerKm")
            + numeric_input(p, "connectors") * numeric_input(p, "connectorDB")
            + numeric_input(p, "splices") * numeric_input(p, "spliceDB")
        )
        budget_use = loss + numeric_input(p, "engineeringMarginDB")
        active = (numeric_input(p, "uplinks") - numeric_input(p, "lostUplinks")) * numeric_input(
            p, "uplinkGbps"
        )
        margin = numeric_input(p, "budgetDB") - budget_use
        return {
            "physicalLossDB": loss,
            "budgetUseDB": budget_use,
            "remainingMarginDB": margin,
            "activeUplinkGbps": active,
            "oversubscription": numeric_input(p, "downlinks")
            * numeric_input(p, "downlinkGbps")
            / active
            if active > 0
            else None,
            "connectivity": "connected" if active > 0 else "disconnected",
            "status": "screen-satisfied" if margin >= 0 else "screen-failed",
        }
    if model == "facilityScreen":
        return {
            "averageKPa": numeric_input(p, "massKG")
            * numeric_input(p, "gravityMS2")
            / numeric_input(p, "areaM2")
            / 1000,
            "installedThermalKW": numeric_input(p, "coolingUnits")
            * numeric_input(p, "tonsPerUnit")
            * numeric_input(p, "kwPerTon"),
        }
    if model == "commissioningScreen":
        restore = sum(numeric_sequence(p, "stageSeconds"))
        annual_it = numeric_input(p, "itMW") * numeric_input(p, "hours")
        return {
            "restoreSeconds": restore,
            "thermalMarginSeconds": numeric_input(p, "thermalSeconds") - restore,
            "electricalMarginSeconds": numeric_input(p, "electricalSeconds") - restore,
            "annualItMWh": annual_it,
            "annualFacilityMWh": annual_it * numeric_input(p, "pue"),
            "pueStandardUncertainty": numeric_input(p, "pue")
            * math.hypot(
                numeric_input(p, "facilityRelativeUncertainty"),
                numeric_input(p, "itRelativeUncertainty"),
            ),
        }
    if model == "designReview":
        available = (
            numeric_input(p, "unitsPerSide") - numeric_input(p, "unavailable")
        ) * numeric_input(p, "unitMVA")
        full_load = (
            numeric_input(p, "unitMVA") * 1000 / math.sqrt(3) / numeric_input(p, "voltageKV")
        )
        capacity_margin = available - numeric_input(p, "demandMVA")
        current_margin = numeric_input(p, "incomerA") - full_load
        return {
            "availableMVA": available,
            "marginMVA": capacity_margin,
            "minimumNPlusOne": math.ceil(
                numeric_input(p, "demandMVA") / numeric_input(p, "unitMVA")
            )
            + 1,
            "fullLoadA": full_load,
            "incomerMarginA": current_margin,
            "capacityStatus": "screen-satisfied" if capacity_margin >= 0 else "screen-failed",
            "currentStatus": "screen-satisfied" if current_margin >= 0 else "screen-failed",
        }
    raise ValueError("No independent equation for model: " + model)


def assert_same(case_id: str, label: str, actual: object, wanted: object) -> None:
    if isinstance(wanted, bool):
        if type(actual) is not bool or actual is not wanted:
            raise AssertionError(f"{case_id}: {label}: got {actual!r}, expected boolean {wanted!r}")
        return
    if wanted is None or isinstance(wanted, str):
        if actual != wanted:
            raise AssertionError(f"{case_id}: {label}: got {actual!r}, expected {wanted!r}")
        return
    if (
        isinstance(actual, bool)
        or not isinstance(actual, (int, float))
        or not math.isfinite(actual)
    ):
        raise AssertionError(f"{case_id}: {label}: got non-finite/non-numeric {actual!r}")
    if not isinstance(wanted, (int, float)) or not math.isfinite(wanted):
        raise AssertionError(f"{case_id}: {label}: invalid numeric expectation {wanted!r}")
    if not math.isclose(actual, wanted, rel_tol=1e-11, abs_tol=1e-10):
        raise AssertionError(f"{case_id}: {label}: got {actual!r}, expected {wanted!r}")


def node_executable() -> str:
    """Resolve the installed runtime before launching fixed repository checks."""
    node = shutil.which("node")
    if node is None:
        raise RuntimeError("Node.js is required to verify the typed JavaScript calculations")
    return str(Path(node).resolve())


def node_version() -> str:
    # A resolved runtime receives only the literal version flag, without a shell.
    return subprocess.check_output(  # noqa: S603
        [node_executable(), "--version"], text=True, timeout=10
    ).strip()


def actual_typescript_results(cases: list[GoldenCase]) -> list[BrowserResult]:
    source = """
import {calculateScreen} from './apps/web/src/infrastructure/screens.ts';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const cases = JSON.parse(input);
console.log(JSON.stringify(cases.map((item) => ({
  id: item.id,
  result: calculateScreen(item.model, item.inputs),
}))));
"""
    command = [
        node_executable(),
        "--experimental-strip-types",
        "--loader",
        "./" + NODE_RESOLVER.relative_to(ROOT).as_posix(),
        "--input-type=module",
        "-e",
        source,
    ]
    # Resolved Node runs fixed repository code; cases enter only as JSON stdin.
    # shell=False is the default, and the verifier has a 60-second bound.
    process = subprocess.run(  # noqa: S603
        command,
        cwd=ROOT,
        input=json.dumps(cases, allow_nan=False),
        text=True,
        capture_output=True,
        check=False,
        timeout=60,
    )
    if process.returncode:
        raise RuntimeError("Typed JavaScript calculation failed:\n" + process.stderr)
    return browser_results(json.loads(process.stdout))


def main() -> None:
    cases = golden_cases(json.loads(CASES_PATH.read_text(encoding="utf-8")))
    if len(cases) != 24 or len({case["id"] for case in cases}) != 24:
        raise AssertionError("Expected exactly 24 unique default/challenge cases")
    actual = actual_typescript_results(cases)
    if len(actual) != len(cases):
        raise AssertionError("Typed JavaScript returned a different number of cases")

    comparisons = 0
    for case, js_result in zip(cases, actual, strict=True):
        if js_result["id"] != case["id"]:
            raise AssertionError("Golden case ordering changed")
        independently_computed = expected(case["model"], case["inputs"])
        for key, golden_value in case["expected"].items():
            assert_same(case["id"], "golden." + key, independently_computed[key], golden_value)
            comparisons += 1
        for key, wanted in independently_computed.items():
            assert_same(case["id"], "typescript." + key, js_result["result"][key], wanted)
            comparisons += 1

    sys.stdout.write(
        (
            json.dumps(
                {
                    "status": "passed",
                    "cases": len(cases),
                    "numericAndStateComparisons": comparisons,
                    "scope": (
                        "Independent Python equations compared with the typed browser"
                        " module; educational screens only."
                    ),
                    "python": sys.version.split()[0],
                    "node": node_version(),
                },
                indent=2,
            )
        )
        + "\n"
    )


if __name__ == "__main__":
    main()
