"""Fetch two optional, hash-pinned Pyodide wheels for the advanced studies.

Run explicitly before prepare_browser_demo.py. No packages are executed here.
The normal continuity and RLC entry paths never download these wheels.
"""

from hashlib import sha256
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


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
        with urlopen(url, timeout=120) as response:
            data = response.read(24 * 1024 * 1024 + 1)
        if len(data) > 24 * 1024 * 1024 or sha256(data).hexdigest() != entry["sha256"]:
            raise SystemExit(f"Size or SHA-256 mismatch: {name}")
        path.write_bytes(data)
        print(f"Verified {name} {entry['version']}: {len(data)} bytes")


if __name__ == "__main__":
    main()
