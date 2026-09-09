import importlib.util
import json
from dataclasses import replace
import unittest

from datacenter_twin.browser import dispatch_json, scenario_report, scenario_sweep
from datacenter_twin.continuity import simulate_continuity
from datacenter_twin.contracts import InputError, MAX_SCENARIO_BYTES
from datacenter_twin.demo import PRESETS, demo_scenario
from datacenter_twin.sensitivity import sweep_continuity


class BrowserBridgeTests(unittest.TestCase):
    def test_native_and_json_adapter_match_for_every_preset(self):
        for preset in PRESETS:
            with self.subTest(preset=preset):
                scenario = demo_scenario(preset)
                native = simulate_continuity(scenario).to_dict()
                adapted = json.loads(dispatch_json("simulations", json.dumps(scenario.to_dict())))
                self.assertEqual(adapted, native)

    def test_duplicate_invalid_and_unknown_inputs_are_rejected_without_execution(self):
        with self.assertRaisesRegex(InputError, "Duplicate JSON field"):
            dispatch_json("simulations", '{"schema_version":2,"schema_version":1}')
        with self.assertRaises(InputError):
            dispatch_json("simulations", "not-json")
        with self.assertRaisesRegex(InputError, "Unsupported browser operation"):
            # The unsupported route is rejected before this malformed body is parsed.
            dispatch_json("unknown-operation", "not-json")
        with self.assertRaisesRegex(InputError, "4 MiB"):
            dispatch_json("simulations", " " * (MAX_SCENARIO_BYTES + 1))

    def test_report_and_sweep_adapter_contracts_preserve_hashes_and_escape_html(self):
        scenario = replace(demo_scenario("generator_failure"), name="<script>alert(1)</script>")
        report_payload = {"scenario": scenario.to_dict(), "format": "html"}
        report = scenario_report(report_payload)
        adapted_report = json.loads(dispatch_json("reports", json.dumps(report_payload)))
        self.assertEqual(adapted_report, report)
        self.assertEqual(report["run_id"], simulate_continuity(scenario).run_id)
        self.assertIn("&lt;script&gt;", report["text"])
        self.assertNotIn("<script>", report["text"])

        sweep_payload = {"scenario": scenario.to_dict(), "parameter": "battery_initial_kwh", "values": [0, 50, 100]}
        expected = sweep_continuity(scenario, "battery_initial_kwh", [0, 50, 100])
        adapted_sweep = json.loads(dispatch_json("sweeps", json.dumps(sweep_payload)))
        self.assertEqual(adapted_sweep, expected)
        self.assertEqual(adapted_sweep["base_input_sha256"], simulate_continuity(scenario).input_sha256)
        self.assertEqual([run["input_sha256"] for run in adapted_sweep["runs"]],
                         [run["result"]["input_sha256"] for run in adapted_sweep["runs"]])

    def test_invalid_report_and_sweep_shapes_are_contract_errors(self):
        scenario = demo_scenario("normal").to_dict()
        invalid_reports = ({"scenario": scenario}, {"scenario": scenario, "format": "xml"}, {})
        for payload in invalid_reports:
            with self.subTest(payload=payload), self.assertRaises(InputError):
                scenario_report(payload)
        for payload in ({"scenario": scenario}, {"scenario": scenario, "parameter": "battery_initial_kwh", "values": []},
                        {"scenario": scenario, "parameter": [], "values": [1]}):
            with self.subTest(payload=payload), self.assertRaises(InputError):
                scenario_sweep(payload)


HAS_API = importlib.util.find_spec("fastapi") is not None and importlib.util.find_spec("httpx") is not None


@unittest.skipUnless(HAS_API, "Install the api and test-api extras to exercise HTTP bridge contracts")
class BrowserHttpTests(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient
        from datacenter_twin.api import create_app
        self.client = TestClient(create_app())

    def tearDown(self):
        self.client.close()

    def test_report_and_sweep_http_contracts(self):
        scenario = replace(demo_scenario("generator_failure"), name="<img src=x onerror=alert(1)>")
        report_payload = {"scenario": scenario.to_dict(), "format": "html"}
        response = self.client.post("/api/v1/reports", json=report_payload)
        self.assertEqual(response.status_code, 200, response.text)
        report = response.json()
        self.assertEqual(report, scenario_report(report_payload))
        self.assertIn("&lt;img", report["text"])
        self.assertNotIn("<img", report["text"])
        self.assertEqual(report["run_id"], simulate_continuity(scenario).run_id)

        sweep_payload = {"scenario": scenario.to_dict(), "parameter": "battery_initial_kwh", "values": [0, 50, 100]}
        response = self.client.post("/api/v1/sweeps", json=sweep_payload)
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result, scenario_sweep(sweep_payload))
        self.assertEqual(result["base_input_sha256"], simulate_continuity(scenario).input_sha256)

        for payload in ({"scenario": scenario.to_dict()}, {"scenario": scenario.to_dict(), "format": "xml"}):
            self.assertEqual(self.client.post("/api/v1/reports", json=payload).status_code, 422)
        for payload in ({"scenario": scenario.to_dict()},
                        {"scenario": scenario.to_dict(), "parameter": "battery_initial_kwh", "values": []},
                        {"scenario": scenario.to_dict(), "parameter": "battery_initial_kwh", "values": ["1", "1.0"]}):
            self.assertEqual(self.client.post("/api/v1/sweeps", json=payload).status_code, 422)
