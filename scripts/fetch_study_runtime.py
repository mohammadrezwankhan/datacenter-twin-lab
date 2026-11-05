"""Fetch two optional, hash-pinned Pyodide wheels for the advanced studies.

Run explicitly before prepare_browser_demo.py. No packages are executed here.
The normal continuity and RLC entry paths never download these wheels.
"""

import json
import sys
import time
from hashlib import sha256
from http.client import HTTPResponse, IncompleteRead
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import (
    HTTPDefaultErrorHandler,
    HTTPErrorProcessor,
    HTTPRedirectHandler,
    HTTPSHandler,
    OpenerDirector,
    UnknownHandler,
)

ROOT = Path(__file__).resolve().parents[1]
MAX_WHEEL_BYTES = 24 * 1024 * 1024
MAX_DOWNLOAD_ATTEMPTS = 3


def _is_transient(error: Exception) -> bool:
    """Retry transport interruptions, not certificate or permanent HTTP errors."""
    if isinstance(error, HTTPError):
        return error.code in {408, 429, 500, 502, 503, 504}
    cause = error.reason if isinstance(error, URLError) else error
    return isinstance(cause, (ConnectionError, TimeoutError, IncompleteRead))


def _open_https(url: str, *, timeout: float) -> HTTPResponse:
    """Use a transport with no file, FTP, or plaintext HTTP handlers.

    HTTPS redirects retain the standard urllib error and retry behavior. A
    redirect to any other protocol fails because no handler can open it.
    """
    opener = OpenerDirector()
    for handler in (
        HTTPSHandler(),
        HTTPDefaultErrorHandler(),
        HTTPErrorProcessor(),
        HTTPRedirectHandler(),
        UnknownHandler(),
    ):
        opener.add_handler(handler)
    response: HTTPResponse = opener.open(url, timeout=timeout)
    return response


def _download_wheel(url: str, expected_sha256: str, name: str) -> bytes:
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise ValueError("Runtime downloads require an HTTPS URL without credentials")
    for attempt in range(1, MAX_DOWNLOAD_ATTEMPTS + 1):
        try:
            with _open_https(url, timeout=120) as response:
                data = response.read(MAX_WHEEL_BYTES + 1)
        except (URLError, ConnectionError, TimeoutError, IncompleteRead) as error:
            if isinstance(error, HTTPError):
                error.close()
            if not _is_transient(error) or attempt == MAX_DOWNLOAD_ATTEMPTS:
                raise
            delay = 2 ** (attempt - 1)
            sys.stdout.write(
                f"Interrupted {name} download; retrying in {delay}s ({attempt + 1}/3)\n"
            )
            time.sleep(delay)
            continue

        # Integrity failures are terminal. Only complete, verified bytes enter the cache.
        if len(data) > MAX_WHEEL_BYTES or sha256(data).hexdigest() != expected_sha256:
            raise SystemExit(f"Size or SHA-256 mismatch: {name}")
        return data
    raise AssertionError("Download attempts exhausted without a result")


def main() -> None:
    runtime = ROOT / "apps/web/node_modules/pyodide"
    version = json.loads((runtime / "package.json").read_text(encoding="utf-8"))["version"]
    locked_version = json.loads((ROOT / "apps/web/package.json").read_text(encoding="utf-8"))[
        "devDependencies"
    ]["pyodide"]
    if version != locked_version:
        raise SystemExit(f"Expected locked Pyodide {locked_version}")
    packages = json.loads((runtime / "pyodide-lock.json").read_text())["packages"]
    target = ROOT / ".local/study-runtime"
    target.mkdir(parents=True, exist_ok=True)
    for name in ("numpy", "scipy"):
        entry = packages[name]
        path = target / entry["file_name"]
        if path.name != entry["file_name"]:
            raise SystemExit("Unsafe runtime filename")
        if path.is_file() and sha256(path.read_bytes()).hexdigest() == entry["sha256"]:
            sys.stdout.write(f"Verified cached {name} {entry['version']}\n")
            continue
        url = f"https://cdn.jsdelivr.net/pyodide/v{version}/full/{entry['file_name']}"
        data = _download_wheel(url, entry["sha256"], name)
        path.write_bytes(data)
        sys.stdout.write(f"Verified {name} {entry['version']}: {len(data)} bytes\n")


if __name__ == "__main__":
    main()
