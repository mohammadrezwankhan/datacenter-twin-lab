"""Build an allowlisted Python archive and local browser runtime assets.

Run after npm ci in apps/web. No network access or Git object copying.
"""
from hashlib import sha256
import io
import json
from pathlib import Path
import shutil
import sys
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from datacenter_twin import __version__

MODULES = ("__init__", "browser", "catalog", "contracts", "continuity", "demo",
           "engine", "reporting", "sensitivity", "topology")
RUNTIME_FILES = ("pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm",
                 "python_stdlib.zip", "pyodide-lock.json")


def prepare() -> dict:
    output = ROOT / ".local" / "browser-demo-assets"
    runtime = ROOT / "apps/web/node_modules/pyodide"
    package = json.loads((runtime / "package.json").read_text(encoding="utf-8"))
    if package["version"] != "314.0.6":
        raise SystemExit("Expected locked Pyodide 314.0.6; run npm ci in apps/web")
    (output / "pyodide").mkdir(parents=True, exist_ok=True)
    files = [f"datacenter_twin/{name}.py" for name in MODULES]
    files += [p.relative_to(ROOT).as_posix() for p in sorted((ROOT / "datacenter_twin/resources").glob("*.json"))]
    files += ["LICENSE", "NOTICE"]
    entries = []
    buffer = io.BytesIO()
    with ZipFile(buffer, "w", compression=ZIP_DEFLATED) as archive:
        for name in sorted(files):
            source = ROOT / name
            if source.is_symlink() or not source.resolve().is_relative_to(ROOT):
                raise SystemExit(f"Refusing nonlocal archive source: {name}")
            data = source.read_bytes().replace(b"\r\n", b"\n")
            info = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, data)
            entries.append({"path": name, "sha256": sha256(data).hexdigest(), "bytes": len(data)})
    data = buffer.getvalue()
    (output / "engine.zip").write_bytes(data)
    manifest = {"engine_version": __version__, "archive_sha256": sha256(data).hexdigest(),
                "archive_bytes": len(data), "files": entries, "pyodide_version": package["version"],
                "note": "Source text is normalized from CRLF to LF before archiving. The browser verifies the archive digest; per-file hashes are audit metadata. No Git history is included."}
    (output / "engine-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    for name in RUNTIME_FILES:
        shutil.copyfile(runtime / name, output / "pyodide" / name)
    shutil.copyfile(ROOT / "apps/web/public/THIRD-PARTY-NOTICES.txt", output / "THIRD-PARTY-NOTICES.txt")
    for source in (ROOT / "docs/third-party").iterdir():
        if source.is_file():
            shutil.copyfile(source, output / "pyodide" / source.name)
    (output / ".nojekyll").write_text("", encoding="utf-8")
    print(json.dumps({"engine_version": __version__, "archive_sha256": manifest["archive_sha256"],
                      "source_files": len(entries), "output": str(output)}))
    return manifest


if __name__ == "__main__":
    prepare()
