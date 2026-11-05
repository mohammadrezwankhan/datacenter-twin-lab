#!/usr/bin/env python3
"""Read static Python dependencies and PEP 735 groups without executing builds."""

from __future__ import annotations

import dataclasses
import pathlib
import re
import tomllib
from typing import Any


@dataclasses.dataclass(frozen=True)
class Manifest:
    """Identify one independently resolvable set of declared dependencies."""

    source: pathlib.Path
    kind: str
    requirements: tuple[str, ...]


def strings(value: object, context: str) -> list[str]:
    """Require a dependency list containing only nonempty requirement strings."""
    if not isinstance(value, list) or any(
        not isinstance(item, str) or not item.strip() for item in value
    ):
        raise ValueError(f"{context} must be a list of nonempty strings")
    return [str(item) for item in value]


def table(value: object, context: str) -> dict[str, Any]:
    """Validate a TOML table before inspecting its dependency declarations."""
    if not isinstance(value, dict) or any(not isinstance(key, str) for key in value):
        raise ValueError(f"{context} must be a table")
    return dict(value)


def normalize_group(name: str) -> str:
    """Normalize group names using the PEP 735 comparison rule."""
    return re.sub(r"[-_.]+", "-", name).lower()


def expand_group(groups: dict[str, Any], name: str, ancestors: tuple[str, ...] = ()) -> list[str]:
    """Expand included groups, rejecting cycles, unknown groups and invalid entries."""
    normalized = normalize_group(name)
    if normalized in ancestors:
        raise ValueError(f"Dependency-group cycle: {' -> '.join((*ancestors, normalized))}")
    matches = [key for key in groups if normalize_group(key) == normalized]
    if len(matches) != 1:
        raise ValueError(f"Dependency group {name!r} is missing or ambiguously named")
    entries = groups[matches[0]]
    if not isinstance(entries, list):
        raise ValueError(f"Dependency group {name!r} must be a list")
    result: list[str] = []
    for entry in entries:
        if isinstance(entry, str) and entry.strip():
            result.append(entry)
        elif (
            isinstance(entry, dict)
            and set(entry) == {"include-group"}
            and isinstance(entry["include-group"], str)
        ):
            result.extend(expand_group(groups, entry["include-group"], (*ancestors, normalized)))
        else:
            raise ValueError(f"Invalid dependency-group entry in {name!r}")
    return result


def manifests_for(path: pathlib.Path) -> list[Manifest]:
    """Collect runtime, optional, build and development dependency declarations."""
    with path.open("rb") as source:
        data = tomllib.load(source)
    project = table(data.get("project", {}), f"{path}: project")
    dynamic = strings(project.get("dynamic", []), f"{path}: project.dynamic")
    if {"dependencies", "optional-dependencies"}.intersection(dynamic):
        raise ValueError(f"{path}: dynamic dependencies require an explicit audited lockfile")
    runtime = strings(project.get("dependencies", []), f"{path}: dependencies")
    result: list[Manifest] = []
    if runtime:
        result.append(Manifest(path, "runtime", tuple(runtime)))
    optional = table(project.get("optional-dependencies", {}), f"{path}: extras")
    for name, dependencies in sorted(optional.items()):
        values = strings(dependencies, f"{path}: extra {name}")
        if values:
            result.append(Manifest(path, f"extra-{name}", (*runtime, *values)))
    build = table(data.get("build-system", {}), f"{path}: build-system")
    build_requires = strings(build.get("requires", []), f"{path}: build requirements")
    if build_requires:
        result.append(Manifest(path, "build", tuple(build_requires)))
    groups = table(data.get("dependency-groups", {}), f"{path}: dependency-groups")
    for name in sorted(groups):
        values = expand_group(groups, name)
        if values:
            result.append(Manifest(path, f"group-{name}", tuple(values)))
    return result


def expand_local_editable(path: pathlib.Path) -> tuple[str, ...] | None:
    """Expand an adjacent static editable project without executing its build."""
    lines = [
        line.strip()
        for line in path.read_text().splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    if not any(line.startswith(("-e", "--editable")) for line in lines):
        return None
    result: list[str] = []
    for line in lines:
        if not line.startswith("-"):
            result.append(line)
            continue
        match = re.fullmatch(r"(?:-e|--editable)\s+\.(?:\[([A-Za-z0-9_,.-]+)\])?", line)
        if match is None:
            raise ValueError(
                f"{path}: editable audits only support the adjacent static project; "
                "other options, paths and URLs require an explicit audited lock"
            )
        project_path = path.parent / "pyproject.toml"
        if project_path.is_symlink():
            raise ValueError(f"{path}: editable metadata must not be a symlink")
        manifests = manifests_for(project_path)
        selected = ["runtime"]
        if match[1] is not None:
            selected.extend(f"extra-{name}" for name in match[1].split(","))
        for name in selected:
            candidates = [
                manifest
                for manifest in manifests
                if normalize_group(manifest.kind) == normalize_group(name)
            ]
            if not candidates and name == "runtime":
                continue
            if len(candidates) != 1:
                raise ValueError(f"{path}: missing or ambiguous editable extra {name!r}")
            result.extend(candidates[0].requirements)
    if not result:
        raise ValueError(f"{path}: editable project has no auditable dependencies")
    return tuple(dict.fromkeys(result))
