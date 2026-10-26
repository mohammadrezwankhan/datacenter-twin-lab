from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import warnings
from zipfile import ZipFile

from scripts.verify_distribution import verify_web_inventory


class WebInventoryTests(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.web_root = Path(self.directory.name) / "web"
        self.files = {
            "index.html": b"<html>current dashboard</html>",
            "assets/current.js": b"console.log('current');",
            "assets/current.css": b"body { color: black; }",
            "data/evidence/2.0.0/manifest.json": b'{"version":"2.0.0"}',
        }
        for name, content in self.files.items():
            target = self.web_root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)

    def verify(self, files=None, *, require_web=False, directories=(), web_root=None):
        entries = list(self.files.items()) if files is None else files
        buffer = BytesIO()
        with ZipFile(buffer, "w") as archive:
            archive.writestr("datacenter_twin/__init__.py", b"# unrelated package data")
            archive.writestr("example.dist-info/METADATA", b"Name: example")
            for directory in directories:
                archive.writestr("datacenter_twin/web/" + directory, b"")
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)
                for name, content in entries:
                    archive.writestr("datacenter_twin/web/" + name, content)
        buffer.seek(0)
        with ZipFile(buffer) as archive:
            verify_web_inventory(archive, web_root or self.web_root, require_web=require_web)

    def test_exact_inventory_and_bytes_pass(self):
        self.verify(require_web=True)

    def test_extra_old_evidence_packet_fails(self):
        files = list(self.files.items()) + [("data/evidence/1.0.0/manifest.json", b"old")]
        with self.assertRaisesRegex(RuntimeError, "extra"):
            self.verify(files)

    def test_extra_obsolete_hashed_assets_fail(self):
        for name in ("assets/old-abc123.js", "assets/old-abc123.css"):
            with self.subTest(name=name), self.assertRaisesRegex(RuntimeError, "extra"):
                self.verify(list(self.files.items()) + [(name, b"old")])

    def test_changed_bytes_fail(self):
        files = dict(self.files, **{"assets/current.js": b"old code, same filename"})
        with self.assertRaisesRegex(RuntimeError, "hash mismatch"):
            self.verify(list(files.items()))

    def test_missing_current_file_fails(self):
        files = [(name, content) for name, content in self.files.items() if not name.endswith("manifest.json")]
        with self.assertRaisesRegex(RuntimeError, "missing"):
            self.verify(files)

    def test_duplicate_web_file_fails(self):
        with self.assertRaisesRegex(RuntimeError, "Duplicate"):
            self.verify(list(self.files.items()) + [("index.html", self.files["index.html"])])

    def test_directory_records_are_ignored(self):
        self.verify(require_web=True, directories=("", "assets/", "data/evidence/"))

    def test_core_only_is_optional_even_with_existing_build(self):
        self.verify([])

    def test_core_only_directory_records_are_ignored(self):
        self.verify([], directories=("", "assets/"))

    def test_core_only_is_required_even_with_existing_build(self):
        with self.assertRaises(RuntimeError):
            self.verify([], require_web=True)

    def test_core_only_without_build_is_optional(self):
        self.verify([], web_root=self.web_root / "absent")

    def test_bundled_web_requires_current_build(self):
        with self.assertRaisesRegex(RuntimeError, "current native build"):
            self.verify(web_root=self.web_root / "absent")

    def test_bundled_web_rejects_empty_current_build(self):
        empty = Path(self.directory.name) / "empty"
        empty.mkdir()
        with self.assertRaises(RuntimeError):
            self.verify(web_root=empty)


if __name__ == "__main__":
    unittest.main()
