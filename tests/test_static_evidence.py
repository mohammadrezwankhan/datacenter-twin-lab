"""Exercise installed dashboard files at realistic long installation paths."""

import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


HAS_API = (
    importlib.util.find_spec("fastapi") is not None
    and importlib.util.find_spec("httpx") is not None
)


@unittest.skipUnless(HAS_API, "Install api and test-api extras for static-file checks")
class InstalledEvidenceTests(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient
        from datacenter_twin.api import create_app

        # Use the native extended path only to create and clean the Windows fixture.
        # The application receives a normal module path, as it does after installation.
        temp_root = os.path.abspath(tempfile.gettempdir())
        if os.name == "nt":
            temp_root = "\\\\?\\" + temp_root
        self.workspace = tempfile.TemporaryDirectory(prefix="dtl-static-", dir=temp_root)
        self.addCleanup(self.workspace.cleanup)
        workspace = Path(self.workspace.name)
        package = workspace / ("installation-" + "x" * 90) / "Lib/site-packages/datacenter_twin"
        web = package / "web"
        evidence = web / "data/evidence/v0.4.0rc1"
        evidence.mkdir(parents=True)
        self.assertTrue(evidence.is_relative_to(workspace))
        (web / "index.html").write_text("<h1>Installed dashboard</h1>", encoding="utf-8")
        self.filename = "report-canonical-1mw-100kwh-" + "a" * 64 + ".html"
        self.expected = b"<h1>Battery ride-through: 307.8 s</h1>"
        report = evidence / self.filename
        report.write_bytes(self.expected)
        self.assertGreater(len(str(report).removeprefix("\\\\?\\")), 260)
        (package / "private.txt").write_text("must remain outside the served directory", encoding="utf-8")

        module_path = str(package / "api.py").removeprefix("\\\\?\\")
        with patch("datacenter_twin.api.__file__", module_path):
            self.client = TestClient(create_app())
        self.addCleanup(self.client.close)

    def test_installed_report_beyond_windows_max_path_is_served(self):
        response = self.client.get("/data/evidence/v0.4.0rc1/" + self.filename)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.content, self.expected)
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")
        self.assertTrue(response.headers["content-type"].startswith("text/html"))

    def test_extended_directory_keeps_parent_files_outside_the_dashboard(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        for target in ("/%2e%2e/private.txt", "/data/%2e%2e/%2e%2e/private.txt"):
            with self.subTest(target=target):
                response = self.client.get(target)
                self.assertEqual(response.status_code, 404)
                self.assertNotIn("must remain outside", response.text)


if __name__ == "__main__":
    unittest.main()
