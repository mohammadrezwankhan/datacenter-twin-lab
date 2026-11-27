"""Reject ambiguous or oversized study files before calculation or publication."""

import json
import subprocess
import sys
import unittest
from importlib.util import find_spec
from pathlib import Path
from tempfile import TemporaryDirectory

from datacenter_twin.contracts import MAX_SCENARIO_BYTES
from datacenter_twin.emt import DEFAULT_EMT


class StudyConfigCliTests(unittest.TestCase):
    def test_duplicate_config_fields_are_rejected_without_output(self) -> None:
        emt = json.dumps(DEFAULT_EMT)[:-1] + ', "source_v": 400}'
        for command, content, field in (
            (["datacenter_twin.emt"], emt, "source_v"),
            (
                ["datacenter_twin.research", "--study", "modal"],
                '{"load_pu": 0.3, "load_pu": 0.7}',
                "load_pu",
            ),
        ):
            with self.subTest(module=command[0]), TemporaryDirectory() as directory:
                if command[0] == "datacenter_twin.research" and not all(
                    find_spec(name) is not None for name in ("numpy", "scipy")
                ):
                    self.skipTest("research CLI requires the optional NumPy/SciPy stack")
                source = Path(directory) / "config.json"
                output = Path(directory) / "result.json"
                source.write_text(content, encoding="utf-8")
                result = subprocess.run(  # noqa: S603
                    [
                        sys.executable,
                        "-m",
                        *command,
                        "--config",
                        str(source),
                        "--output",
                        str(output),
                    ],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    timeout=30,
                    check=False,
                )
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertIn(f"Duplicate JSON field: {field}", result.stderr)
                self.assertEqual(result.stdout, "")
                self.assertNotIn("Traceback", result.stderr)
                self.assertFalse(output.exists())

    def test_oversized_config_files_are_rejected_without_output(self) -> None:
        for command, config in (
            (["datacenter_twin.emt"], DEFAULT_EMT),
            (["datacenter_twin.research", "--study", "modal"], {}),
        ):
            with self.subTest(module=command[0]), TemporaryDirectory() as directory:
                if command[0] == "datacenter_twin.research" and not all(
                    find_spec(name) is not None for name in ("numpy", "scipy")
                ):
                    self.skipTest("research CLI requires the optional NumPy/SciPy stack")
                source = Path(directory) / "config.json"
                output = Path(directory) / "result.json"
                source.write_bytes(json.dumps(config).encode() + b" " * MAX_SCENARIO_BYTES)
                result = subprocess.run(  # noqa: S603
                    [
                        sys.executable,
                        "-m",
                        *command,
                        "--config",
                        str(source),
                        "--output",
                        str(output),
                    ],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    timeout=30,
                    check=False,
                )
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertIn("4 MiB input limit", result.stderr)
                self.assertEqual(result.stdout, "")
                self.assertNotIn("Traceback", result.stderr)
                self.assertFalse(output.exists())
