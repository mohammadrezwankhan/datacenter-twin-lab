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
from datacenter_twin.demo import PRESETS, demo_scenario
from datacenter_twin.catalog import load_catalog

MODULES = ("__init__", "browser", "catalog", "contracts", "continuity", "demo",
           "engine", "emt", "reporting", "sensitivity", "topology")
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
            info.create_system = 3
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
    research = ROOT / "datacenter_twin/research"
    if research.is_dir():
        # Only reviewed source modules, never uploaded archives or bytecode.
        research_entries = []
        research_buffer = io.BytesIO()
        with ZipFile(research_buffer, "w", compression=ZIP_DEFLATED) as archive:
            for source in sorted(research.glob("*.py")):
                if source.is_symlink() or not source.resolve().is_relative_to(research.resolve()):
                    raise SystemExit("Refusing nonlocal research source")
                name = source.relative_to(ROOT).as_posix()
                data = source.read_bytes().replace(b"\r\n", b"\n")
                info = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
                info.create_system = 3
                info.compress_type = ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                archive.writestr(info, data)
                research_entries.append({"path": name, "bytes": len(data), "sha256": sha256(data).hexdigest()})
        data = research_buffer.getvalue()
        (output / "research.zip").write_bytes(data)
        packages = json.loads((runtime / "pyodide-lock.json").read_text(encoding="utf-8"))["packages"]
        runtime_entries = []
        for name in ("numpy", "scipy"):
            entry = packages[name]
            wheel = ROOT / ".local/study-runtime" / entry["file_name"]
            if not wheel.is_file() or sha256(wheel.read_bytes()).hexdigest() != entry["sha256"]:
                raise SystemExit("Run python scripts/fetch_study_runtime.py before preparing advanced studies")
            shutil.copyfile(wheel, output / "pyodide" / wheel.name)
            runtime_entries.append({"name": name, "version": entry["version"],
                                    "sha256": entry["sha256"], "bytes": wheel.stat().st_size})
        (output / "research-manifest.json").write_text(json.dumps({
            "archive_sha256": sha256(data).hexdigest(), "archive_bytes": len(data),
            "files": research_entries, "runtime": runtime_entries,
            "note": "Reviewed numerical source only; no uploaded zip, bytecode, private metadata or Git objects.",
        }, indent=2) + "\n", encoding="utf-8")
    shutil.copyfile(ROOT / "apps/web/public/THIRD-PARTY-NOTICES.txt", output / "THIRD-PARTY-NOTICES.txt")
    shutil.copyfile(ROOT / "apps/web/public/favicon.png", output / "favicon.png")
    for source in (ROOT / "docs/third-party").iterdir():
        if source.is_file():
            shutil.copyfile(source, output / "pyodide" / source.name)
    # Preserve the existing MKLab migration redirects and preview indexing rules.
    for name in ("_headers", "_redirects", "llms.txt"):
        shutil.copyfile(ROOT / "apps/web/public" / name, output / name)
    # Small scenario inputs feed JavaScript; the Python archive stays optional.
    demo_data = {"engine_version": __version__,
                 "presets": [{"id": key, "name": name} for key, name in PRESETS.items()],
                 "scenarios": {key: demo_scenario(key).to_dict() for key in PRESETS}}
    (output / "demo-data.json").write_text(
        json.dumps(demo_data, separators=(",", ":")) + "\n", encoding="utf-8")
    (output / "catalog.json").write_text(
        json.dumps(load_catalog(), separators=(",", ":")) + "\n", encoding="utf-8")
    (output / ".nojekyll").write_text("", encoding="utf-8")
    # Only the versioned, explicitly hashed public proof packet joins the site.
    evidence = ROOT / "data/evidence" / f"v{__version__}"
    evidence_manifest = json.loads((evidence / "manifest.json").read_text(encoding="utf-8"))
    if evidence_manifest["engine_version"] != __version__:
        raise SystemExit("Evidence packet version does not match the engine")
    evidence_target = output / "data/evidence" / f"v{__version__}"
    evidence_target.mkdir(parents=True, exist_ok=True)
    for name, entry in evidence_manifest["artifacts"].items():
        source = evidence / name
        if Path(name).name != name or source.is_symlink() or not source.resolve().is_relative_to(evidence.resolve()):
            raise SystemExit(f"Unsafe evidence source: {name}")
        data = source.read_bytes().replace(b"\r\n", b"\n")
        if sha256(data).hexdigest() != entry["sha256"]:
            raise SystemExit(f"Evidence hash mismatch: {name}")
        (evidence_target / name).write_bytes(data)
    shutil.copyfile(evidence / "manifest.json", evidence_target / "manifest.json")
    shutil.copyfile(ROOT / "data/evidence" / f"index-v{__version__}.json", output / "evidence-index.json")
    # Original, on-demand evidence media is never requested by the first experiment.
    for name in ("guide-preview.png", "guide-predict.png", "guide-result.png", "guide-evidence.png",
                 "proof-demo.webm", "proof-demo.vtt"):
        source = ROOT / "docs/images" / name
        if source.is_file():
            shutil.copyfile(source, output / name)
    print(json.dumps({"engine_version": __version__, "archive_sha256": manifest["archive_sha256"],
                      "source_files": len(entries), "output": str(output)}))
    return manifest


if __name__ == "__main__":
    prepare()
