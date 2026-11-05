"""Network-free regressions for interrupted optional-runtime downloads."""

import io
import json
import ssl
import tempfile
import unittest
from contextlib import redirect_stdout
from email.message import Message
from hashlib import sha256
from http.client import IncompleteRead
from pathlib import Path
from unittest.mock import call, patch
from urllib.error import HTTPError, URLError
from urllib.request import HTTPHandler, HTTPSHandler
from urllib.response import addinfourl

from scripts import fetch_study_runtime as fetch


class RuntimeDownloadTests(unittest.TestCase):
    def setUp(self) -> None:
        self.payload = b"a complete hash-pinned wheel"
        self.digest = sha256(self.payload).hexdigest()
        self.url = "https://example.invalid/pinned.whl"
        self.sleep = self.enterContext(patch("scripts.fetch_study_runtime.time.sleep"))
        self.open = self.enterContext(patch.object(fetch, "_open_https"))
        self.enterContext(redirect_stdout(io.StringIO()))

    def download(self) -> bytes:
        return fetch._download_wheel(self.url, self.digest, "scipy")

    def test_non_https_and_credential_urls_fail_before_transport(self) -> None:
        for url in (
            "file:///tmp/pinned.whl",
            "http://example.invalid/pinned.whl",
            "ftp://example.invalid/pinned.whl",
            "https:///pinned.whl",
            "https://user:placeholder@example.invalid/pinned.whl",
        ):
            self.open.reset_mock()
            self.open.return_value = io.BytesIO(self.payload)
            with self.subTest(url=url), self.assertRaisesRegex(ValueError, "HTTPS"):
                fetch._download_wheel(url, self.digest, "scipy")
            self.open.assert_not_called()

    def test_connection_reset_and_interrupted_read_retry_complete_download(self) -> None:
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

    def test_retries_stop_after_three_attempts(self) -> None:
        self.open.side_effect = TimeoutError("download timed out")
        with self.assertRaisesRegex(TimeoutError, "download timed out"):
            self.download()
        self.assertEqual(self.open.call_count, 3)
        self.assertEqual(self.sleep.call_args_list, [call(1), call(2)])

    def test_transient_http_error_can_recover(self) -> None:
        self.open.side_effect = [
            HTTPError(self.url, 503, "Unavailable", Message(), io.BytesIO()),
            io.BytesIO(self.payload),
        ]
        self.assertEqual(self.download(), self.payload)
        self.sleep.assert_called_once_with(1)

    def test_permanent_http_and_certificate_errors_are_not_retried(self) -> None:
        errors = [
            HTTPError(self.url, 403, "Forbidden", Message(), io.BytesIO()),
            HTTPError(self.url, 404, "Not found", Message(), io.BytesIO()),
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

    def test_corrupt_or_oversized_response_is_terminal(self) -> None:
        for data in [b"corrupt", self.payload * 2]:
            with self.subTest(data=data), patch.object(fetch, "MAX_WHEEL_BYTES", len(self.payload)):
                self.open.reset_mock()
                self.open.return_value = io.BytesIO(data)
                with self.assertRaisesRegex(SystemExit, "Size or SHA-256 mismatch"):
                    self.download()
                self.open.assert_called_once()
        self.sleep.assert_not_called()

    def test_main_rejects_runtime_version_that_differs_from_web_manifest(self) -> None:
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(fetch, "ROOT", Path(directory)),
        ):
            root = Path(directory)
            web = root / "apps/web"
            web.mkdir(parents=True)
            (web / "package.json").write_text(
                json.dumps({"devDependencies": {"pyodide": "314.0.7"}})
            )
            runtime = web / "node_modules/pyodide"
            runtime.mkdir(parents=True)
            (runtime / "package.json").write_text(json.dumps({"version": "314.0.6"}))
            packages = {
                name: {"file_name": name + ".whl", "sha256": self.digest, "version": "test"}
                for name in ["numpy", "scipy"]
            }
            (runtime / "pyodide-lock.json").write_text(json.dumps({"packages": packages}))
            with (
                patch.object(fetch, "_download_wheel", return_value=self.payload),
                self.assertRaisesRegex(SystemExit, "Expected locked Pyodide 314.0.7"),
            ):
                fetch.main()

    def test_main_writes_only_verified_bytes_and_reuses_cache(self) -> None:
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(fetch, "ROOT", Path(directory)),
        ):
            root = Path(directory)
            web = root / "apps/web"
            web.mkdir(parents=True)
            (web / "package.json").write_text(
                json.dumps({"devDependencies": {"pyodide": "314.0.7"}})
            )
            runtime = web / "node_modules/pyodide"
            runtime.mkdir(parents=True)
            (runtime / "package.json").write_text(json.dumps({"version": "314.0.7"}))
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


class _HttpsResponse(addinfourl):
    """A real urllib response wrapper backed by bytes, without a network socket."""

    def __init__(self, url: str, code: int, body: bytes, headers: Message | None = None) -> None:
        super().__init__(io.BytesIO(body), headers if headers is not None else Message(), url, code)
        self.msg = "test response"


class RuntimeTransportPolicyTests(unittest.TestCase):
    def test_https_redirect_retains_verified_bytes_and_closes_responses(self) -> None:
        original = "https://example.invalid/pinned.whl"
        redirected = "https://cdn.example.invalid/pinned.whl"
        payload = b"a complete hash-pinned wheel"
        headers = Message()
        headers["Location"] = redirected
        first = _HttpsResponse(original, 302, b"", headers)
        final = _HttpsResponse(redirected, 200, payload)
        with patch.object(HTTPSHandler, "https_open", side_effect=[first, final]) as opened:
            self.assertEqual(
                fetch._download_wheel(original, sha256(payload).hexdigest(), "scipy"), payload
            )
        self.assertEqual(opened.call_count, 2)
        self.assertEqual(
            [call.args[0].full_url for call in opened.call_args_list], [original, redirected]
        )
        self.assertTrue(first.closed)
        self.assertTrue(final.closed)

    def test_redirect_cannot_enable_plaintext_or_local_file_transports(self) -> None:
        original = "https://example.invalid/pinned.whl"
        for target in (
            "http://example.invalid/pinned.whl",
            "ftp://example.invalid/pinned.whl",
            "file:///tmp/pinned.whl",
        ):
            headers = Message()
            headers["Location"] = target
            response = _HttpsResponse(original, 302, b"", headers)
            with (
                self.subTest(target=target),
                patch.object(HTTPSHandler, "https_open", return_value=response) as secured,
                patch.object(HTTPHandler, "http_open") as plaintext,
                self.assertRaises(URLError),
            ):
                fetch._download_wheel(original, sha256(b"unused").hexdigest(), "scipy")
            secured.assert_called_once()
            plaintext.assert_not_called()


if __name__ == "__main__":
    unittest.main()
