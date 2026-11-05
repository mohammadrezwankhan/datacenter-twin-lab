import json
import subprocess
import sys
import unittest
from ipaddress import IPv4Address
from pathlib import Path
from tempfile import TemporaryDirectory

from datacenter_twin import __version__

ROOT = Path(__file__).resolve().parents[1]
BASE = "data/scenarios/baseline-1mw.json"
ALT = "data/scenarios/alternative-pue-115.json"


class CliTests(unittest.TestCase):
    def command(self, *args: str) -> subprocess.CompletedProcess[str]:
        # Fixed interpreter and owned module; literal/temp-path args, no shell, 15 s.
        return subprocess.run(  # noqa: S603
            [sys.executable, "-m", "datacenter_twin", *args],
            cwd=ROOT,
            text=True,
            encoding="utf-8",
            capture_output=True,
            timeout=15,
        )

    def test_run_prints_machine_readable_results(self) -> None:
        completed = self.command("run", BASE)
        self.assertEqual(completed.returncode, 0, completed.stderr)
        payload = json.loads(completed.stdout)
        self.assertEqual(payload["result"]["energy_only_cost"], "1095000.00")
        self.assertIn("+00:00", payload["generated_at_utc"])

    def test_comparison_export(self) -> None:
        with TemporaryDirectory() as directory:
            path = Path(directory) / "nested/comparison.json"
            completed = self.command("compare", BASE, ALT, "--output", str(path))
            self.assertEqual(completed.returncode, 0, completed.stderr)
            payload = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(payload["result"]["energy_only_cost_saving"], "87600.00")

    def test_invalid_input_is_actionable_without_traceback(self) -> None:
        with TemporaryDirectory() as directory:
            path = Path(directory) / "bad.json"
            path.write_text('{"unexpected":true}', encoding="utf-8")
            completed = self.command("run", str(path))
            self.assertEqual(completed.returncode, 2)
            self.assertIn("missing fields", completed.stderr)
            self.assertNotIn("Traceback", completed.stderr)

    def test_input_cannot_be_overwritten_by_export(self) -> None:
        with TemporaryDirectory() as directory:
            path = Path(directory) / "scenario.json"
            original = (ROOT / BASE).read_bytes()
            path.write_bytes(original)
            completed = self.command("run", str(path), "--output", str(path))
            self.assertEqual(completed.returncode, 2)
            self.assertEqual(path.read_bytes(), original)

    def test_all_demo_scenarios_run(self) -> None:
        for path in (ROOT / "data/scenarios").glob("*.json"):
            with self.subTest(path=path.name):
                completed = self.command("run", str(path))
                self.assertEqual(completed.returncode, 0, completed.stderr)

    def test_version(self) -> None:
        completed = self.command("--version")
        self.assertEqual(completed.returncode, 0)
        self.assertEqual(completed.stdout.strip(), __version__)

    def test_continuity_presets_and_input_protection(self) -> None:
        from datacenter_twin.demo import PRESETS

        for preset in PRESETS:
            completed = self.command("simulate", "--preset", preset)
            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertEqual(json.loads(completed.stdout)["result"]["schema_version"], 2)
        with TemporaryDirectory() as directory:
            path = Path(directory) / "scenario.json"
            original = (ROOT / "datacenter_twin/resources/reference-site-v2.json").read_bytes()
            path.write_bytes(original)
            completed = self.command(
                "simulate", "--scenario", str(path), "--output", str(path), "--force"
            )
            self.assertEqual(completed.returncode, 2, completed.stderr)
            self.assertEqual(path.read_bytes(), original)

    def test_ambiguous_continuity_source_and_invalid_port_rejected(self) -> None:
        self.assertEqual(
            self.command("simulate", "--scenario", BASE, "--preset", "normal").returncode, 2
        )
        self.assertEqual(self.command("serve", "--port", "0").returncode, 2)
        self.assertEqual(self.command("serve", "--host", str(IPv4Address(0))).returncode, 2)
