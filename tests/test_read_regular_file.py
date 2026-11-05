"""Real-filesystem races at the native build reader's acquisition boundary."""

from __future__ import annotations

import errno
import os
import subprocess
import sys
import tempfile
import unittest
from collections.abc import Callable
from pathlib import Path
from unittest.mock import patch

from scripts import read_regular_file as reader


class RegularFileTests(unittest.TestCase):
    def setUp(self) -> None:
        directory = tempfile.TemporaryDirectory(prefix="twin-native-reader-")
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.source = self.root / "source"
        self.original = self.root / "original"
        self.source.write_bytes(b"original content")

    def rejected_read(
        self,
        *,
        before: Callable[[], None] | None = None,
        after: Callable[[], None] | None = None,
        after_data: Callable[[], None] | None = None,
        pattern: str,
        acquire: Callable[[Path], int] | None = None,
        minimum_opened: int = 1,
    ) -> None:
        """Change real entries; never fake file bytes, types, or identities."""
        opened: list[int] = []
        real_acquire = acquire or reader._open_metadata
        real_data = reader._open_data

        def acquire_file(path: Path) -> int:
            if before is not None:
                before()
            try:
                descriptor = real_acquire(path)
                opened.append(descriptor)
                return descriptor
            finally:
                if after is not None:
                    after()

        def acquire_data(descriptor: int) -> int:
            result = real_data(descriptor)
            opened.append(result)
            if after_data is not None:
                after_data()
            return result

        with (
            patch.object(reader, "_open_metadata", side_effect=acquire_file),
            patch.object(reader, "_open_data", side_effect=acquire_data),
            patch.object(os, "read", wraps=os.read) as reads,
        ):
            with self.assertRaisesRegex((OSError, ValueError), pattern):
                reader.read_regular_file(self.source)
            self.assertEqual(reads.call_count, 0, "No content read may precede rejection")
        self.assertGreaterEqual(len(opened), minimum_opened)
        for descriptor in opened:
            with self.assertRaises(OSError) as closed:
                os.fstat(descriptor)
            self.assertEqual(closed.exception.errno, errno.EBADF)

    def test_exact_binary_content(self) -> None:
        contents = bytes(range(256)) * 8193
        self.source.write_bytes(contents)
        self.assertEqual(reader.read_regular_file(self.source), contents)

    def test_read_only_source_directory(self) -> None:
        if sys.platform == "win32":
            # Windows directory write permissions use ACLs, not chmod bits.
            self.assertEqual(reader.read_regular_file(self.source), b"original content")
        else:
            self.source.chmod(0o400)
            self.root.chmod(0o500)
            try:
                self.assertEqual(reader.read_regular_file(self.source), b"original content")
            finally:
                self.root.chmod(0o700)
                self.source.chmod(0o600)

    def test_symlink_directory_missing_and_device(self) -> None:
        link = self.root / "linked"
        link.symlink_to(self.source)
        directory = self.root / "directory"
        directory.mkdir()
        device = Path("NUL" if sys.platform == "win32" else "/dev/null")
        for path in (link, directory, device):
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, "regular file"):
                reader.read_regular_file(path)
        with self.assertRaises(FileNotFoundError):
            reader.read_regular_file(self.root / "missing")

    def test_replacement_before_open_and_descriptor_closure(self) -> None:
        def replace() -> None:
            self.source.rename(self.original)
            self.source.write_bytes(b"replacement content")

        self.rejected_read(before=replace, pattern="changed while opening")

    def test_late_same_inode_symlink(self) -> None:
        def replace() -> None:
            self.source.rename(self.original)
            self.source.symlink_to(self.original)

        self.rejected_read(
            before=replace,
            pattern="regular file",
            minimum_opened=int(sys.platform in ("linux", "win32")),
        )

    def test_transient_same_inode_symlink(self) -> None:
        def replace() -> None:
            self.source.rename(self.original)
            self.source.symlink_to(self.original)

        def restore() -> None:
            self.source.unlink()
            self.original.rename(self.source)

        self.rejected_read(
            before=replace,
            after=restore,
            pattern="regular file",
            minimum_opened=int(sys.platform in ("linux", "win32")),
        )

    def test_replacement_after_metadata_open(self) -> None:
        def replace() -> None:
            self.source.rename(self.original)
            self.source.write_bytes(b"replacement content")

        self.rejected_read(after=replace, pattern="changed while opening")

    def test_disappearance_after_metadata_open(self) -> None:
        def remove() -> None:
            self.source.rename(self.original)

        self.rejected_read(
            after=remove,
            pattern="No such file|cannot find",
        )

    def test_replacement_after_data_open(self) -> None:
        def replace() -> None:
            self.source.rename(self.original)
            self.source.write_bytes(b"replacement content")

        self.rejected_read(after_data=replace, pattern="changed while opening", minimum_opened=2)

    def test_read_failure_closes_both_descriptors(self) -> None:
        opened: list[int] = []
        real_acquire = reader._open_metadata
        real_data = reader._open_data

        def acquire(path: Path) -> int:
            descriptor = real_acquire(path)
            opened.append(descriptor)
            return descriptor

        def data(descriptor: int) -> int:
            result = real_data(descriptor)
            opened.append(result)
            return result

        with (
            patch.object(reader, "_open_metadata", side_effect=acquire),
            patch.object(reader, "_open_data", side_effect=data),
            patch.object(os, "read", side_effect=OSError(errno.EIO, "read failure")),
            self.assertRaisesRegex(OSError, "read failure"),
        ):
            reader.read_regular_file(self.source)
        self.assertEqual(len(opened), 2)
        for descriptor in opened:
            with self.assertRaises(OSError) as closed:
                os.fstat(descriptor)
            self.assertEqual(closed.exception.errno, errno.EBADF)

    def test_posix_no_follow_rejects_transient_symlink(self) -> None:
        if sys.platform == "win32":
            # This runner exercises CreateFileW/ReOpenFile in the tests above.
            self.assertEqual(reader.read_regular_file(self.source), b"original content")
        else:
            def replace() -> None:
                self.source.rename(self.original)
                self.source.symlink_to(self.original)

            def restore() -> None:
                self.source.unlink()
                self.original.rename(self.source)

            self.rejected_read(
                before=replace,
                after=restore,
                pattern="regular file",
                acquire=reader._open_posix,
                minimum_opened=0,
            )

    def test_fifo_substitution_is_nonblocking(self) -> None:
        if sys.platform == "win32":
            # Windows does not expose POSIX FIFOs; NUL must not be read.
            with self.assertRaisesRegex(ValueError, "regular file"):
                reader.read_regular_file(Path("NUL"))
        else:
            # A subprocess timeout catches an accidentally blocking open without
            # hanging the entire regression suite. Paths are argv values, no shell.
            result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "unittest",
                    "tests.test_read_regular_file.RegularFileTests.fifo_probe",
                ],
                cwd=Path(__file__).resolve().parents[1],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def fifo_probe(self) -> None:
        """Run only in the timeout-bounded child, for both native POSIX paths."""
        if sys.platform == "win32":
            self.fail("The FIFO probe requires POSIX")
        else:
            for acquire in (reader._open_metadata, reader._open_posix):
                with self.subTest(acquire=acquire.__name__):

                    def replace() -> None:
                        self.source.rename(self.original)
                        os.mkfifo(self.source)

                    self.rejected_read(before=replace, pattern="regular file", acquire=acquire)
                    self.source.unlink()
                    self.original.rename(self.source)


if __name__ == "__main__":
    unittest.main()
