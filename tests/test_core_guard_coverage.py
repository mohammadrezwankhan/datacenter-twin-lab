"""Discriminating public-boundary checks for reports, commands, and inputs."""

from __future__ import annotations

import io
import json
import runpy
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from dataclasses import replace
from decimal import Decimal
from fractions import Fraction
from importlib.util import find_spec
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch, sentinel

from datacenter_twin import browser, cli, emt
from datacenter_twin.continuity import simulate_continuity
from datacenter_twin.contracts import (
    InputError,
    Scenario,
    load_json_document,
    load_scenario,
    number,
)
from datacenter_twin.demo import PRESETS, demo_scenario
from datacenter_twin.engine import simulate
from datacenter_twin.output import write_result
from datacenter_twin.reporting import render_html, render_markdown
from datacenter_twin.sensitivity import _with_parameter, sweep_continuity
from datacenter_twin.topology import Asset, Dependency, Event, SiteScenario, string_list

ROOT = Path(__file__).resolve().parents[1]


class CoreInputBoundaryTests(unittest.TestCase):
    def test_decimal_representation_limit_counts_the_original_text(self) -> None:
        self.assertEqual(number("0" * 128, "quantity"), Decimal(0))
        with self.assertRaisesRegex(InputError, "finite decimal"):
            number("0" * 129, "quantity")

    def test_text_status_and_source_collection_contracts(self) -> None:
        data = load_scenario(ROOT / "data/scenarios/baseline-1mw.json").to_dict()
        valid = Scenario.from_dict({**data, "id": "x" * 200})
        self.assertEqual(valid.id, "x" * 200)
        invalid: tuple[tuple[dict[str, object], str], ...] = (
            ({"id": "x" * 201}, "nonempty text"),
            ({"id": " "}, "nonempty text"),
            ({"price_status": "observed"}, "illustrative or unknown"),
            ({"source_ids": "reference-id"}, "JSON list"),
        )
        for replacement, message in invalid:
            with self.subTest(replacement=replacement), self.assertRaisesRegex(InputError, message):
                Scenario.from_dict({**data, **replacement})

    def test_engine_rejects_an_unvalidated_json_object(self) -> None:
        with self.assertRaisesRegex(InputError, "validated Scenario"):
            simulate(json.loads("{}"))

    def test_scenario_boundaries_reject_nonstring_keys_and_nonsequence_intervals(self) -> None:
        scenario = load_scenario(ROOT / "data/scenarios/baseline-1mw.json")
        with self.assertRaisesRegex(InputError, "field names must be strings"):
            Scenario.from_dict({1: "untrusted key"})
        with self.assertRaisesRegex(InputError, "Segment instances"):
            replace(scenario, segments=json.loads('"not a sequence"'))
        with self.assertRaisesRegex(InputError, "use from_dict for JSON objects"):
            replace(scenario, segments=json.loads("[{}]"))
        for document in ('"not a sequence"', "null"):
            with self.subTest(document=document), self.assertRaisesRegex(InputError, "list"):
                Scenario.from_dict({**scenario.to_dict(), "segments": json.loads(document)})
        with TemporaryDirectory() as directory, self.assertRaisesRegex(InputError, "regular file"):
            load_json_document(Path(directory) / "absent.json")

    def test_unknown_presets_and_internal_sweep_fields_cannot_escape_validation(self) -> None:
        with self.assertRaisesRegex(InputError, "Unknown demo preset"):
            demo_scenario("unregistered-case")
        with self.assertRaisesRegex(InputError, "Unsupported sweep parameter"):
            _with_parameter(demo_scenario(), "currency", Decimal(1))

    def test_identifier_lists_enforce_shape_size_and_uniqueness(self) -> None:
        self.assertEqual(string_list([], "ids", nonempty=False), ())
        self.assertEqual(string_list(["first", "second"], "ids"), ("first", "second"))
        invalid: tuple[object, ...] = (None, "first", [], ["x"] * 101, ["x", "x"])
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(InputError):
                string_list(value, "ids")

    def test_topology_records_reject_unsupported_physical_meanings(self) -> None:
        asset = demo_scenario().assets[0].to_dict()
        with self.assertRaisesRegex(InputError, "unsupported asset type"):
            Asset.from_dict({**asset, "kind": "unmodelled-device"})
        for relation in ("feeds", "requires", "charges"):
            with (
                self.subTest(relation=relation),
                self.assertRaisesRegex(InputError, "distinct endpoints"),
            ):
                Dependency("same", "same", relation)
        with self.assertRaisesRegex(InputError, "relation required"):
            Dependency("source", "target", "unmodelled-relation")
        with self.assertRaisesRegex(InputError, "unsupported simulated event"):
            Event(0, "unmodelled-action", "utility", None)
        with self.assertRaisesRegex(InputError, "must be null"):
            Event(0, "asset_down", "utility", Decimal(1))

    def test_topology_json_collections_have_real_limits(self) -> None:
        data = demo_scenario().to_dict()
        for field, maximum in (("assets", 64), ("dependencies", 256), ("events", 128)):
            invalid_values: tuple[object, ...] = ({}, [None] * (maximum + 1))
            for value in invalid_values:
                with (
                    self.subTest(field=field, value_type=type(value)),
                    self.assertRaisesRegex(InputError, "bounded JSON array"),
                ):
                    SiteScenario.from_dict({**data, field: value})

    def test_topology_constructor_rejects_wrong_records_and_duplicate_ids(self) -> None:
        scenario = demo_scenario()
        with self.assertRaisesRegex(InputError, "Asset records"):
            replace(scenario, assets=json.loads("[{}]"))
        with self.assertRaisesRegex(InputError, "Asset identifiers must be unique"):
            replace(scenario, assets=(*scenario.assets, scenario.assets[0]))
        with self.assertRaisesRegex(InputError, "Duplicate dependency"):
            replace(scenario, dependencies=(*scenario.dependencies, scenario.dependencies[0]))
        for kind in ("utility", "generator", "battery", "load"):
            with self.subTest(kind=kind), self.assertRaisesRegex(InputError, "exactly one " + kind):
                replace(
                    scenario, assets=tuple(asset for asset in scenario.assets if asset.kind != kind)
                )

    def test_topology_rejects_reversed_energy_and_invalid_charging_paths(self) -> None:
        scenario = demo_scenario()
        for dependency, message in (
            (Dependency("it-load", "utility", "feeds"), "toward the load"),
            (Dependency("utility", "battery", "charges"), "bus to the battery"),
        ):
            with self.subTest(dependency=dependency), self.assertRaisesRegex(InputError, message):
                replace(scenario, dependencies=(*scenario.dependencies, dependency))

    def test_generator_delay_sweep_preserves_whole_seconds_and_input(self) -> None:
        scenario = demo_scenario("utility_loss")
        before = scenario.to_dict()
        result = sweep_continuity(scenario, "generator_start_delay_s", ["0", "60.0"])
        self.assertEqual(result["values"], ["0", "60"])
        self.assertEqual(
            [run["result"]["scenario"]["generator_start_delay_s"] for run in result["runs"]],
            [0, 60],
        )
        self.assertEqual(scenario.to_dict(), before)
        with self.assertRaisesRegex(InputError, "validated SiteScenario"):
            sweep_continuity(scenario.to_dict(), "generator_start_delay_s", ["0"])


class CoreReportBoundaryTests(unittest.TestCase):
    def test_renderers_reject_incomplete_or_nonobject_results(self) -> None:
        invalid = ("null", "[]", "{}", '{"scenario":[]}', '{"scenario":{}}')
        for document in invalid:
            for renderer in (render_html, render_markdown):
                with (
                    self.subTest(document=document, renderer=renderer.__name__),
                    self.assertRaises(InputError),
                ):
                    renderer(json.loads(document))

    def test_compact_sweep_reports_retain_warning_counts(self) -> None:
        with patch("datacenter_twin.sensitivity._MAX_FULL_RESULT_BYTES", 1):
            result = sweep_continuity(
                demo_scenario("generator_failure"), "battery_initial_kwh", ["0", "100"]
            )
        self.assertFalse(result["full_results_included"])
        self.assertTrue(all("result" not in run for run in result["runs"]))
        counts = [run["summary"]["warning_counts"] for run in result["runs"]]
        self.assertTrue(any(counts))
        for renderer in (render_html, render_markdown):
            text = renderer(result)
            self.assertIn("interval(s)", text.replace("\\", ""))
            for warning in {name for entry in counts for name in entry}:
                expected_count = sum(entry.get(warning, 0) for entry in counts)
                self.assertIn(warning, text.replace("\\", ""))
                self.assertIn(f"{expected_count} interval", text)
            self.assertIn(result["runs"][0]["run_id"], text)

    def test_browser_routes_expose_declared_presets_catalog_and_emt(self) -> None:
        presets = json.loads(browser.dispatch_json("presets"))
        self.assertEqual([item["id"] for item in presets], list(PRESETS))
        default = json.loads(browser.dispatch_json("demo"))
        self.assertEqual(default, demo_scenario("utility_loss").to_dict())
        catalog = json.loads(browser.dispatch_json("catalog"))
        self.assertIsInstance(catalog, dict)
        result = json.loads(browser.dispatch_json("emt", json.dumps(emt.DEFAULT_EMT)))
        self.assertEqual(result["model"], "dc-link-rlc-v1")
        self.assertEqual(result["rows"][0]["time_ms"], 0)
        self.assertEqual(result["rows"][-1]["time_ms"], 200)
        self.assertLess(abs(result["summary"]["balance_error_j"]), 0.001)

    def test_browser_planning_route_preserves_known_energy_and_cost(self) -> None:
        scenario = (ROOT / "data/scenarios/baseline-1mw.json").read_text(encoding="utf-8")
        result = json.loads(browser.dispatch_json("planning", scenario))
        self.assertEqual(result["energy_only_cost"], "1095000.00")
        self.assertEqual(result["currency"], "USD")

    def test_browser_quote_route_preserves_vendor_billing_unit(self) -> None:
        for offer, expected in (("aws-p5", "48.00"), ("oci-h100", "384.00")):
            payload = {"offer_id": offer, "node_count": 2, "billed_hours": "3", "assumed_rate": "8"}
            with self.subTest(offer=offer):
                result = json.loads(browser.dispatch_json("quotes/normalize", json.dumps(payload)))
                self.assertEqual(result["cost"], expected)
                self.assertEqual(result["price_status"], "user_assumption")

    @unittest.skipUnless(find_spec("fastapi") is not None, "optional API is required")
    def test_windows_web_paths_keep_drive_and_unc_extended_path_semantics(self) -> None:
        from datacenter_twin import api

        for normalized, expected in (
            (r"C:\install\web", r"\\?\C:\install\web"),
            (r"\\server\share\web", r"\\?\UNC\server\share\web"),
            (r"\\?\C:\install\web", r"\\?\C:\install\web"),
        ):
            # Substitute only the platform normalization result so this Windows
            # prefix policy is checked on every CI operating system.
            def normalized_path(_path: object, value: str = normalized) -> str:
                return value

            platform = SimpleNamespace(name="nt", path=SimpleNamespace(normpath=normalized_path))
            with self.subTest(normalized=normalized), patch.object(api, "os", platform):
                self.assertEqual(str(api._web_directory()), expected)


class CoreCommandBoundaryTests(unittest.TestCase):
    def test_cli_continuity_and_sweep_have_both_human_report_formats(self) -> None:
        for command in ("simulate", "sweep"):
            for format_name in ("markdown", "html"):
                args = [command, "--preset", "generator_failure", "--format", format_name]
                if command == "sweep":
                    args.extend(["--parameter", "it_demand_kw", "--values", "1000"])
                output = io.StringIO()
                with (
                    self.subTest(command=command, format_name=format_name),
                    redirect_stdout(output),
                ):
                    self.assertEqual(cli.main(args), 0)
                text = output.getvalue()
                self.assertIn("Datacenter Twin Lab", text)
                self.assertIn("<!doctype html>" if format_name == "html" else "# ", text)

    def test_cli_force_requires_a_destination(self) -> None:
        error = io.StringIO()
        with redirect_stderr(error), self.assertRaises(SystemExit) as raised:
            cli.main(["simulate", "--force"])
        self.assertEqual(raised.exception.code, 2)
        self.assertIn("--force requires --output", error.getvalue())

    def test_serve_reports_missing_optional_dependency_before_starting(self) -> None:
        error = io.StringIO()
        with (
            patch.dict(sys.modules, {"uvicorn": None}),
            redirect_stderr(error),
            self.assertRaises(SystemExit) as raised,
        ):
            cli.main(["serve"])
        self.assertEqual(raised.exception.code, 2)
        self.assertIn("Install the API extra", error.getvalue())

    @unittest.skipUnless(
        find_spec("uvicorn") is not None and find_spec("fastapi") is not None,
        "optional API dependencies are required for server argument checks",
    )
    def test_serve_preserves_loopback_binding_at_valid_port_boundaries(self) -> None:
        for port in (1, 65535):
            with (
                self.subTest(port=port),
                patch("uvicorn.run") as run,
                patch("datacenter_twin.api.create_app", return_value=sentinel.application),
            ):
                self.assertEqual(cli.main(["serve", "--port", str(port)]), 0)
                run.assert_called_once_with(
                    sentinel.application, host="127.0.0.1", port=port, access_log=False
                )

    def test_emt_module_stdout_preserves_independent_initial_state(self) -> None:
        output = io.StringIO()
        with (
            patch.object(sys, "argv", ["datacenter_twin.emt", "--preset", "short-dip"]),
            patch.dict(sys.modules),
            redirect_stdout(output),
        ):
            # Exercise the real module entry point in a fresh import namespace.
            sys.modules.pop("datacenter_twin.emt", None)
            runpy.run_module("datacenter_twin.emt", run_name="__main__")
        result = json.loads(output.getvalue())
        self.assertEqual(result["config"], emt.EMT_PRESETS["short-dip"])
        self.assertAlmostEqual(result["rows"][0]["bus_v"], 800 * 12.8 / 12.88, places=10)
        self.assertEqual(len(result["rows"]), 2001)

    def test_emt_config_export_is_atomic_and_protects_the_input(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            source, destination = root / "config.json", root / "result.json"
            original = json.dumps({**emt.DEFAULT_EMT, "step_us": 50})
            source.write_text(original, encoding="utf-8")
            args = ["datacenter_twin.emt", "--config", str(source), "--output", str(destination)]
            with patch.object(sys, "argv", args), redirect_stdout(io.StringIO()):
                emt.main()
            complete = destination.read_bytes()
            result = json.loads(complete)
            self.assertEqual(result["config"]["step_us"], 50)
            self.assertEqual(result["rows"][-1]["time_ms"], 200)
            with (
                patch.object(sys, "argv", args),
                redirect_stderr(io.StringIO()),
                self.assertRaises(SystemExit) as raised,
            ):
                emt.main()
            self.assertEqual(raised.exception.code, 2)
            self.assertEqual(destination.read_bytes(), complete)
            with (
                patch.object(sys, "argv", [*args, "--force"]),
                redirect_stdout(io.StringIO()),
            ):
                emt.main()
            self.assertEqual(destination.read_bytes(), complete)
            protected = ["datacenter_twin.emt", "--config", str(source), "--output", str(source)]
            with (
                patch.object(sys, "argv", [*protected, "--force"]),
                redirect_stderr(io.StringIO()),
                self.assertRaises(SystemExit),
            ):
                emt.main()
            self.assertEqual(source.read_text(encoding="utf-8"), original)

    def test_emt_force_requires_a_destination(self) -> None:
        error = io.StringIO()
        with (
            patch.object(sys, "argv", ["datacenter_twin.emt", "--force"]),
            redirect_stderr(error),
            self.assertRaises(SystemExit) as raised,
        ):
            emt.main()
        self.assertEqual(raised.exception.code, 2)
        self.assertIn("--force requires --output", error.getvalue())


class CoreOutputBoundaryTests(unittest.TestCase):
    def test_directory_destination_is_rejected_without_mutation(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(InputError, "regular file"):
                write_result(root, "result", force=True)
            self.assertEqual(list(root.iterdir()), [])

    def test_temporary_creation_failure_preserves_existing_result(self) -> None:
        with TemporaryDirectory() as directory:
            path = Path(directory) / "result.json"
            path.write_text("original", encoding="utf-8")
            with (
                patch(
                    "datacenter_twin.output.NamedTemporaryFile",
                    side_effect=PermissionError("No permission for temporary file"),
                ),
                self.assertRaisesRegex(PermissionError, "temporary file"),
            ):
                write_result(path, "replacement", force=True)
            self.assertEqual(path.read_text(encoding="utf-8"), "original")
            self.assertEqual(list(path.parent.iterdir()), [path])


class ContinuityBoundaryBehaviorTests(unittest.TestCase):
    def test_continuity_requires_a_validated_scenario(self) -> None:
        with self.assertRaisesRegex(InputError, "validated SiteScenario"):
            simulate_continuity(json.loads("{}"))

    def test_demand_above_it_envelope_keeps_the_requested_energy_and_warning(self) -> None:
        scenario = replace(
            demo_scenario("normal"), duration_s=60, it_demand_kw=Decimal(1200), events=()
        )
        result = simulate_continuity(scenario).to_dict()
        self.assertEqual(Fraction(result["summary"]["requested_it_kwh"]), Fraction(20))
        self.assertTrue(
            all("IT_ENVELOPE_EXCEEDED" in row["warnings"] for row in result["intervals"])
        )
        self.assertEqual(result["summary"]["energy_balance_residual_kwh"], "0")

    def test_failed_battery_and_load_keep_unavailable_state_in_the_ledger(self) -> None:
        for target in ("battery", "it-load"):
            scenario = replace(
                demo_scenario("normal"),
                duration_s=60,
                events=(Event(0, "asset_down", target, None),),
            )
            with self.subTest(target=target):
                result = simulate_continuity(scenario).to_dict()
                self.assertTrue(
                    all(row["asset_states"][target] == "unavailable" for row in result["intervals"])
                )
                self.assertEqual(result["summary"]["energy_balance_residual_kwh"], "0")
                if target == "battery":
                    self.assertEqual(result["summary"]["battery_final_kwh"], "100")
                else:
                    self.assertEqual(result["summary"]["served_it_kwh"], "0")
                    self.assertLess(
                        abs(Fraction(result["summary"]["unserved_it_kwh"]) - Fraction(50, 3)),
                        Fraction(1, 10**80),
                    )

    def test_declared_generator_rate_is_applied_to_exported_generator_energy(self) -> None:
        scenario = replace(demo_scenario("utility_loss"), generator_cost_per_kwh=Decimal("0.2"))
        summary = simulate_continuity(scenario).summary
        energy = Decimal(summary["generator_kwh"])
        self.assertGreater(energy, 0)
        self.assertEqual(
            summary["generator_energy_charge"],
            format((energy * Decimal("0.2")).quantize(Decimal("0.01")), ".2f"),
        )
        self.assertEqual(summary["cost_status"], "illustrative")
