"""Read build assets through a validated, non-following native file handle.

The final pathname component must remain a regular file with its initial
identity until reading starts. Linux and Windows acquire a metadata-only
handle, then obtain data access to that same object. Other POSIX systems use
O_NOFOLLOW/O_NONBLOCK/O_NOCTTY and validate the descriptor before any read.
No writable source directory, temporary link, shell, or third-party package
is required. This does not lock file contents against concurrent writers.
"""

from __future__ import annotations

import errno
import os
import stat
import sys
from pathlib import Path

if sys.platform == "win32":
    import ctypes
    import msvcrt
    from ctypes import wintypes

    _kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    _kernel32.CreateFileW.argtypes = [
        wintypes.LPCWSTR,
        wintypes.DWORD,
        wintypes.DWORD,
        wintypes.LPVOID,
        wintypes.DWORD,
        wintypes.DWORD,
        wintypes.HANDLE,
    ]
    _kernel32.CreateFileW.restype = wintypes.HANDLE
    _kernel32.ReOpenFile.argtypes = [
        wintypes.HANDLE,
        wintypes.DWORD,
        wintypes.DWORD,
        wintypes.DWORD,
    ]
    _kernel32.ReOpenFile.restype = wintypes.HANDLE
    _kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    _kernel32.CloseHandle.restype = wintypes.BOOL
    _FILE_READ_ATTRIBUTES = 0x00000080
    _GENERIC_READ = 0x80000000
    _FILE_SHARE_ALL = 0x00000007
    _OPEN_EXISTING = 3
    _FILE_FLAG_OPEN_REPARSE_POINT = 0x00200000
    _FILE_FLAG_BACKUP_SEMANTICS = 0x02000000

    def _windows_descriptor(handle: int | None) -> int:
        if handle is None or handle == ctypes.c_void_p(-1).value:
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            # open_osfhandle transfers ownership to the CRT descriptor. Its
            # mode does not grant file-data access to a metadata-only handle.
            return msvcrt.open_osfhandle(handle, os.O_RDONLY | os.O_BINARY | os.O_NOINHERIT)
        except OSError:
            _kernel32.CloseHandle(handle)
            raise


def _regular(info: os.stat_result, path: Path) -> None:
    if not stat.S_ISREG(info.st_mode):
        raise ValueError(f"Expected a regular file: {path}")
    if sys.platform == "win32" and info.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
        raise ValueError(f"Expected a regular file without a reparse point: {path}")


def _same_file(expected: os.stat_result, actual: os.stat_result, path: Path) -> None:
    _regular(actual, path)
    if (actual.st_dev, actual.st_ino) != (expected.st_dev, expected.st_ino):
        raise ValueError(f"File changed while opening: {path}")


if sys.platform != "win32":

    def _open_posix(path: Path) -> int:
        try:
            return os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_NOCTTY)
        except OSError as error:
            if error.errno == errno.ELOOP:
                raise ValueError(f"Expected a regular file: {path}") from error
            raise


if sys.platform == "win32":

    def _open_metadata(path: Path) -> int:
        # fstat's FileBasicInfo query requires FILE_READ_ATTRIBUTES, which
        # grants metadata access without FILE_READ_DATA / GENERIC_READ.
        # OPEN_REPARSE_POINT opens the final link itself, never its target.
        # BACKUP_SEMANTICS allows a directory handle so it can be rejected.
        return _windows_descriptor(
            _kernel32.CreateFileW(
                str(path),
                _FILE_READ_ATTRIBUTES,
                _FILE_SHARE_ALL,
                None,
                _OPEN_EXISTING,
                _FILE_FLAG_OPEN_REPARSE_POINT | _FILE_FLAG_BACKUP_SEMANTICS,
                None,
            )
        )

    def _open_data(descriptor: int) -> int:
        # ReOpenFile takes the verified object handle, not an attackable name.
        return _windows_descriptor(
            _kernel32.ReOpenFile(
                msvcrt.get_osfhandle(descriptor), _GENERIC_READ, _FILE_SHARE_ALL, 0
            )
        )

elif sys.platform == "linux":

    def _open_metadata(path: Path) -> int:
        # O_PATH cannot read a device/FIFO and O_NOFOLLOW captures a symlink
        # itself, even if an attacker immediately restores the original name.
        return os.open(path, os.O_PATH | os.O_NOFOLLOW | os.O_CLOEXEC)

    def _open_data(descriptor: int) -> int:
        # This procfs magic link refers to our held descriptor. If procfs is
        # unavailable, fail closed; never fall back to reopening the pathname.
        return os.open(f"/proc/self/fd/{descriptor}", os.O_RDONLY | os.O_CLOEXEC)

else:

    def _open_metadata(path: Path) -> int:
        return _open_posix(path)

    def _open_data(descriptor: int) -> int:
        return os.dup(descriptor)


def read_regular_file(path: Path) -> bytes:
    """Preserve file identity and reject observed pathname changes before reading."""
    expected = path.lstat()
    _regular(expected, path)
    metadata = _open_metadata(path)
    try:
        actual = os.fstat(metadata)
        _same_file(expected, actual, path)
        _same_file(actual, path.lstat(), path)
        descriptor = _open_data(metadata)
        try:
            _same_file(actual, os.fstat(descriptor), path)
            _same_file(actual, path.lstat(), path)
            chunks: list[bytes] = []
            while chunk := os.read(descriptor, 1024 * 1024):
                chunks.append(chunk)
            return b"".join(chunks)
        finally:
            os.close(descriptor)
    finally:
        os.close(metadata)


def main() -> int:
    """Write raw bytes on success and an errno-bearing diagnostic on failure."""
    if len(sys.argv) != 2:
        sys.stderr.write("Usage: read_regular_file.py PATH\n")
        return 2
    try:
        content = read_regular_file(Path(sys.argv[1]))
        if sys.platform == "win32":
            msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
        sys.stdout.buffer.write(content)
    except (OSError, ValueError) as error:
        code = (
            errno.errorcode.get(error.errno or errno.EIO, "EIO")
            if isinstance(error, OSError)
            else "EINVAL"
        )
        sys.stderr.write(f"{code}: {error}\n")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
