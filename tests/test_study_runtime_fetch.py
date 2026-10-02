"""Network-free regressions for interrupted optional-runtime downloads."""

from contextlib import redirect_stdout
from hashlib import sha256
from http.client import IncompleteRead
import io
import json
from pathlib import Path
import ssl
import tempfile
import unittest
from unittest.mock import call, patch
from urllib.error import HTTPError, URLError

from scripts import fetch_study_runtime as fetch


class RuntimeDownloadTests(unittest.TestCase):
    def setUp(self):
        self.payload = b"a complete hash-pinned wheel"
        self.digest = sha256(self.payload).hexdigest()
        self.url = "https://example.invalid/pinned.whl"
        self.sleep = self.enterContext(patch.object(fetch.time, "sleep"))
        self.open = self.enterContext(patch.object(fetch, "urlopen"))
        self.enterContext(redirect_stdout(io.StringIO()))

    def download(self):
        return fetch._download_wheel(self.url, self.digest, "scipy")

    def test_connection_reset_and_interrupted_read_retry_complete_download(self):
        broken = io.BytesIO()
        self.enterContext(patch.object(broken, "read", side_effect=IncompleteRead(b"partial", 10)))
        self.open.side_effect = [
            URLError(ConnectionResetError("connection reset by peer")),
            broken,
            io.BytesIO(self.payload),
        ]
        self.assertEqual(self.download(), self.payload)
        self.assertEqual(self.open.call_args_list, [call(self.url, timeout=120)] * 3)
        self.assertEqual(self.sleep.call_args_list, [call(1), call(2)])
        self.assertTrue(broken.closed)

    def test_retries_stop_after_three_attempts(self):
        self.open.side_effect = TimeoutError("download timed out")
        with self.assertRaisesRegex(TimeoutError, "download timed out"):
            self.download()
        self.assertEqual(self.open.call_count, 3)
        self.assertEqual(self.sleep.call_args_list, [call(1), call(2)])

    def test_transient_http_error_can_recover(self):
        self.open.side_effect = [
            HTTPError(self.url, 503, "Unavailable", {}, io.BytesIO()),
            io.BytesIO(self.payload),
        ]
        self.assertEqual(self.download(), self.payload)
        self.sleep.assert_called_once_with(1)

    def test_permanent_http_and_certificate_errors_are_not_retried(self):
        errors = [
            HTTPError(self.url, 403, "Forbidden", {}, io.BytesIO()),
            HTTPError(self.url, 404, "Not found", {}, io.BytesIO()),
            URLError(ssl.SSLCertVerificationError("certificate rejected")),
        ]
        for error in errors:
            with self.subTest(error=error):
                self.open.reset_mock()
                self.open.side_effect = error
                with self.assertRaises(type(error)):
                    self.download()
                self.open.assert_called_once_with(self.url, timeout=120)
        self.sleep.assert_not_called()

    def test_corrupt_or_oversized_response_is_terminal(self):
        for data in [b"corrupt", self.payload * 2]:
            with self.subTest(data=data), patch.object(fetch, "MAX_WHEEL_BYTES", len(self.payload)):
                self.open.reset_mock()
                self.open.return_value = io.BytesIO(data)
                with self.assertRaisesRegex(SystemExit, "Size or SHA-256 mismatch"):
                    self.download()
                self.open.assert_called_once()
        self.sleep.assert_not_called()

    def test_main_writes_only_verified_bytes_and_reuses_cache(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(fetch, "ROOT", Path(directory)):
            root = Path(directory)
            runtime = root / "apps/web/node_modules/pyodide"
            runtime.mkdir(parents=True)
            (runtime / "package.json").write_text(json.dumps({"version": "314.0.6"}))
            packages = {
                name: {"file_name": name + ".whl", "sha256": self.digest, "version": "test"}
                for name in ["numpy", "scipy"]
            }
            (runtime / "pyodide-lock.json").write_text(json.dumps({"packages": packages}))
            target = root / ".local/study-runtime"
            target.mkdir(parents=True)
            (target / "numpy.whl").write_bytes(self.payload)
            self.open.return_value = io.BytesIO(b"incomplete")
            with self.assertRaises(SystemExit):
                fetch.main()
            self.assertFalse((target / "scipy.whl").exists())
            self.assertEqual((target / "numpy.whl").read_bytes(), self.payload)
            self.open.reset_mock()
            self.open.return_value = io.BytesIO(self.payload)
            fetch.main()
            self.open.assert_called_once()
            self.assertEqual((target / "scipy.whl").read_bytes(), self.payload)
            self.open.reset_mock()
            fetch.main()
            self.open.assert_not_called()


if __name__ == "__main__":
    unittest.main()
