"""Fetch two optional, hash-pinned Pyodide wheels for the advanced studies.

Run explicitly before prepare_browser_demo.py. No packages are executed here.
The normal continuity and RLC entry paths never download these wheels.
"""

from hashlib import sha256
from http.client import IncompleteRead
import json
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
MAX_WHEEL_BYTES = 24 * 1024 * 1024
MAX_DOWNLOAD_ATTEMPTS = 3


def _is_transient(error: Exception) -> bool:
    """Retry transport interruptions, not certificate or permanent HTTP errors."""
    if isinstance(error, HTTPError):
        return error.code in {408, 429, 500, 502, 503, 504}
    if isinstance(error, URLError):
        error = error.reason
    return isinstance(error, (ConnectionError, TimeoutError, IncompleteRead))


def _download_wheel(url: str, expected_sha256: str, name: str) -> bytes:
    for attempt in range(1, MAX_DOWNLOAD_ATTEMPTS + 1):
        try:
            with urlopen(url, timeout=120) as response:
                data = response.read(MAX_WHEEL_BYTES + 1)
        except (URLError, ConnectionError, TimeoutError, IncompleteRead) as error:
            if isinstance(error, HTTPError):
                error.close()
            if not _is_transient(error) or attempt == MAX_DOWNLOAD_ATTEMPTS:
                raise
            delay = 2 ** (attempt - 1)
            print(f"Interrupted {name} download; retrying in {delay}s ({attempt + 1}/3)")
            time.sleep(delay)
            continue

        # Integrity failures are terminal. Only complete, verified bytes enter the cache.
        if len(data) > MAX_WHEEL_BYTES or sha256(data).hexdigest() != expected_sha256:
            raise SystemExit(f"Size or SHA-256 mismatch: {name}")
        return data
    raise AssertionError("Download attempts exhausted without a result")


def main():
    runtime = ROOT / "apps/web/node_modules/pyodide"
    version = json.loads((runtime / "package.json").read_text())["version"]
    if version != "314.0.6":
        raise SystemExit("Expected locked Pyodide 314.0.6")
    packages = json.loads((runtime / "pyodide-lock.json").read_text())["packages"]
    target = ROOT / ".local/study-runtime"
    target.mkdir(parents=True, exist_ok=True)
    for name in ("numpy", "scipy"):
        entry = packages[name]
        path = target / entry["file_name"]
        if path.name != entry["file_name"]:
            raise SystemExit("Unsafe runtime filename")
        if path.is_file() and sha256(path.read_bytes()).hexdigest() == entry["sha256"]:
            print(f"Verified cached {name} {entry['version']}")
            continue
        url = f"https://cdn.jsdelivr.net/pyodide/v{version}/full/{entry['file_name']}"
        data = _download_wheel(url, entry["sha256"], name)
        path.write_bytes(data)
        print(f"Verified {name} {entry['version']}: {len(data)} bytes")


if __name__ == "__main__":
    main()
