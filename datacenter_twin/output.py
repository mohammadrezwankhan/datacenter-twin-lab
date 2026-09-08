"""Publish complete local results without truncating existing files."""

import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Iterable

from .contracts import InputError


def write_result(path: Path, content: str, *, protected_paths: Iterable[Path] = (), force: bool = False) -> None:
    path = Path(path)
    for protected in protected_paths:
        protected = Path(protected)
        if path.resolve() == protected.resolve() or (path.exists() and path.samefile(protected)):
            raise InputError("Output path must not overwrite an input scenario, including file aliases")
    if path.is_symlink():
        raise InputError("Output path must not be a symbolic link")
    if path.exists():
        if not path.is_file():
            raise InputError("Output path must be a regular file")
        if not force:
            raise InputError("Output already exists; choose another path or use --force to replace it")

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = None
    try:
        with NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n", dir=path.parent,
                                prefix=f".{path.name}.", suffix=".tmp", delete=False) as handle:
            temporary_path = Path(handle.name)
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        if force:
            os.replace(temporary_path, path)
        else:
            try:
                # Same-filesystem link creation is atomic and fails if the destination exists.
                os.link(temporary_path, path)
            except FileExistsError as exc:
                raise InputError("Output already exists; choose another path or use --force to replace it") from exc
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
