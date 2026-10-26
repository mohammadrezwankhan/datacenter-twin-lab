"""Build an allowlisted Python archive and local browser runtime assets.

Run after npm ci in apps/web. No network access or Git object copying.
"""
from hashlib import sha256
import io
import json
import os
from pathlib import Path
from pathlib import PurePosixPath
import re
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
ENGINEERING_HERO_FILES = frozenset((
    "hero-1080p60.mp4",
    "poster.png",
    "integration/vanilla/khan-grid-hero.js",
    "integration/vanilla/embed.css",
    "integration/vanilla/host.css",
    "src/config.js",
    "index.html",
    "csp.json",
))


def copy_verified_engineering_hero_media(source_root: Path, public_root: Path) -> dict:
    """Stage only manifest-listed, hash-verified hero release files for Vite."""
    if source_root.is_symlink() or not source_root.is_dir():
        raise SystemExit("Engineering hero release directory is missing or not a regular directory")
    source_root = source_root.resolve()
    release_path = source_root / "release-media.json"
    if release_path.is_symlink() or not release_path.is_file():
        raise SystemExit("Engineering hero release is missing release-media.json")
    release = json.loads(release_path.read_text(encoding="utf-8"))
    expected_metadata = {
        "status": "verified",
        "frames": 900,
        "width": 1920,
        "height": 1080,
        "fps": 60,
        "duration": 15,
    }
    if any(type(release.get(key)) is not type(value) or release.get(key) != value
           for key, value in expected_metadata.items()):
        raise SystemExit("Engineering hero release-media.json does not match the verified 15 s 1080p60 release")
    if not isinstance(release.get("site"), str) or not release["site"].strip():
        raise SystemExit("Engineering hero release-media.json must declare a site")
    entries = release.get("files")
    if not isinstance(entries, list):
        raise SystemExit("Engineering hero release-media.json must include its verified files list")

    names: set[str] = set()
    copies: list[tuple[Path, PurePosixPath]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            raise SystemExit("Malformed engineering hero manifest entry")
        name, size, digest = entry.get("path"), entry.get("bytes"), entry.get("sha256")
        if not isinstance(name, str) or "\\" in name:
            raise SystemExit("Unsafe engineering hero media path")
        relative = PurePosixPath(name)
        if relative.is_absolute() or not relative.parts or any(part in {"", ".", ".."} for part in relative.parts):
            raise SystemExit(f"Unsafe engineering hero media path: {name}")
        if name in names:
            raise SystemExit(f"Duplicate engineering hero media path: {name}")
        names.add(name)
        if type(size) is not int or size < 0 or not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise SystemExit(f"Malformed engineering hero media integrity record: {name}")

        source = source_root.joinpath(*relative.parts)
        current = source_root
        for part in relative.parts:
            current = current / part
            if current.is_symlink():
                raise SystemExit(f"Engineering hero media must not use symbolic links: {name}")
        if not source.is_file() or not source.resolve().is_relative_to(source_root):
            raise SystemExit(f"Engineering hero media file is missing or escapes its release: {name}")
        if source.stat().st_size != size or sha256(source.read_bytes()).hexdigest() != digest:
            raise SystemExit(f"Engineering hero media integrity mismatch: {name}")
        copies.append((source, relative))

    missing = ENGINEERING_HERO_FILES - names
    if missing:
        raise SystemExit(f"Engineering hero release is missing required files: {', '.join(sorted(missing))}")
    target_root = public_root / "assets/engineering-hero/v1"
    for source, relative in copies:
        target = target_root.joinpath(*relative.parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    shutil.copyfile(release_path, target_root / "release-media.json")
    return release


def engineering_hero_enabled() -> bool:
    """Read the explicit process override or Vite's persisted demo-mode setting."""
    if "VITE_ENGINEERING_HERO" in os.environ:
        return os.environ["VITE_ENGINEERING_HERO"] == "1"
    mode_file = ROOT / "apps/web/.env.demo"
    if not mode_file.is_file():
        return False
    for line in mode_file.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator and key.strip() == "VITE_ENGINEERING_HERO":
            return value.strip().strip("\"'") == "1"
    return False


def copy_evidence_packets(source_root: Path, output: Path) -> None:
    """Retain public release URLs, copying only manifest-declared proof files."""
    output = output.resolve()
    for manifest_path in sorted(source_root.glob("v*/manifest.json")):
        evidence = manifest_path.parent
        if evidence.is_symlink() or manifest_path.is_symlink():
            raise SystemExit("Evidence packets must not contain symbolic links")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        target = output / evidence.name
        target.mkdir(parents=True, exist_ok=True)
        for name, entry in manifest["artifacts"].items():
            source = evidence / name
            if (Path(name).name != name or "\\" in name or source.is_symlink()
                    or not source.resolve().is_relative_to(evidence.resolve())):
                raise SystemExit(f"Unsafe evidence source: {name}")
            data = source.read_bytes().replace(b"\r\n", b"\n")
            if sha256(data).hexdigest() != entry["sha256"]:
                raise SystemExit(f"Evidence hash mismatch: {evidence.name}/{name}")
            (target / name).write_bytes(data)
        shutil.copyfile(manifest_path, target / "manifest.json")


def prepare() -> dict:
    output = ROOT / ".local" / "browser-demo-assets"
    runtime = ROOT / "apps/web/node_modules/pyodide"
    package = json.loads((runtime / "package.json").read_text(encoding="utf-8"))
    locked_version = json.loads((ROOT / "apps/web/package.json").read_text(encoding="utf-8"))[
        "devDependencies"
    ]["pyodide"]
    if package["version"] != locked_version:
        raise SystemExit(f"Expected locked Pyodide {locked_version}; run npm ci in apps/web")
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
    for name in ("favicon.png", "favicon.ico", "apple-touch-icon.png", "apple-touch-icon-precomposed.png"):
        shutil.copyfile(ROOT / "apps/web/public" / name, output / name)
    for source in (ROOT / "docs/third-party").iterdir():
        if source.is_file():
            shutil.copyfile(source, output / "pyodide" / source.name)
    # These discovery documents are emitted from the current course catalog by Vite.
    # Remove leftovers from earlier preparations so publicDir cannot re-copy stale metadata.
    for name in ("llms.txt", "knowledge-graph.json", "knowledge-graph.jsonld"):
        stale_discovery = output / name
        if stale_discovery.exists() or stale_discovery.is_symlink():
            stale_discovery.unlink()
    # Preserve the existing MKLab migration redirects and preview indexing rules.
    for name in ("_headers", "_redirects"):
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
    if engineering_hero_enabled():
        copy_verified_engineering_hero_media(
            ROOT / "assets/engineering-hero/v1",
            ROOT / ".local/engineering-hero-public",
        )
    # Retain historical public proof URLs as well as the current packet.
    evidence = ROOT / "data/evidence" / f"v{__version__}"
    evidence_manifest = json.loads((evidence / "manifest.json").read_text(encoding="utf-8"))
    if evidence_manifest["engine_version"] != __version__:
        raise SystemExit("Evidence packet version does not match the engine")
    copy_evidence_packets(ROOT / "data/evidence", output / "data/evidence")
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
