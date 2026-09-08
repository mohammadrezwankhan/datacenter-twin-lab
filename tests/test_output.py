import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from datacenter_twin.contracts import InputError
from datacenter_twin.output import write_result


class OutputTests(unittest.TestCase):
    def test_force_replaces_complete_result(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "result.json"
            path.write_text("previous", encoding="utf-8")
            write_result(path, '{"complete":true}\n', force=True)
            self.assertEqual(path.read_bytes(), b'{"complete":true}\n')
            self.assertEqual(list(Path(directory).iterdir()), [path])

    def test_force_still_protects_hard_linked_input(self):
        with TemporaryDirectory() as directory:
            source, alias = Path(directory) / "source.json", Path(directory) / "alias.json"
            source.write_text("input", encoding="utf-8")
            os.link(source, alias)
            with self.assertRaisesRegex(InputError, "input scenario"):
                write_result(alias, "replacement", protected_paths=[source], force=True)
            self.assertEqual(source.read_text(), "input")

    def test_force_replacement_does_not_truncate_other_hard_links(self):
        with TemporaryDirectory() as directory:
            output, other = Path(directory) / "output.json", Path(directory) / "other.json"
            other.write_text("previous", encoding="utf-8")
            os.link(other, output)
            write_result(output, "new", force=True)
            self.assertEqual(other.read_text(), "previous")
            self.assertEqual(output.read_text(), "new")

    def test_failed_flush_preserves_previous_result_and_cleans_temporary(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "result.json"
            path.write_text("previous", encoding="utf-8")
            with patch("datacenter_twin.output.os.fsync", side_effect=OSError("Disk failure")):
                with self.assertRaisesRegex(OSError, "Disk failure"):
                    write_result(path, "new", force=True)
            self.assertEqual(path.read_text(), "previous")
            self.assertEqual(list(Path(directory).iterdir()), [path])

    def test_failed_replace_preserves_previous_result(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "result.json"
            path.write_text("previous", encoding="utf-8")
            with patch("datacenter_twin.output.os.replace", side_effect=PermissionError("Locked")):
                with self.assertRaises(PermissionError):
                    write_result(path, "new", force=True)
            self.assertEqual(path.read_text(), "previous")
            self.assertEqual(list(Path(directory).iterdir()), [path])

    def test_competing_writer_cannot_be_overwritten_without_force(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "result.json"
            link = os.link

            def competing_write(source, destination):
                Path(destination).write_text("competing result", encoding="utf-8")
                link(source, destination)

            with patch("datacenter_twin.output.os.link", side_effect=competing_write):
                with self.assertRaisesRegex(InputError, "already exists"):
                    write_result(path, "our result")
            self.assertEqual(path.read_text(), "competing result")
            self.assertEqual(list(Path(directory).iterdir()), [path])

    def test_unsupported_atomic_creation_leaves_no_partial_result(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "result.json"
            with patch("datacenter_twin.output.os.link", side_effect=OSError("Unsupported filesystem")):
                with self.assertRaises(OSError):
                    write_result(path, "new")
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_symbolic_link_output_is_rejected(self):
        with TemporaryDirectory() as directory:
            target, alias = Path(directory) / "target.json", Path(directory) / "alias.json"
            target.write_text("previous", encoding="utf-8")
            try:
                alias.symlink_to(target)
            except OSError as exc:
                self.skipTest(f"Symlink creation is unavailable: {exc}")
            with self.assertRaisesRegex(InputError, "symbolic link"):
                write_result(alias, "new", force=True)
            self.assertEqual(target.read_text(), "previous")
