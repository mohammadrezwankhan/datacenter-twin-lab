"""Validate the source-linked learning companion without dependencies."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import quote

# Every SVG parse rejects a DTD in StartDoctypeDeclHandler before entity expansion.
from xml.parsers import expat  # nosemgrep: python.lang.security.use-defused-xml.use-defused-xml


def require(condition: bool, message: str) -> None:
    """Keep validation active even when Python runs with optimization enabled."""
    if not condition:
        raise ValueError(message)


def mapping(value: object, name: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be a JSON object")
    result: dict[str, object] = {}
    for key, item in value.items():
        if not isinstance(key, str):
            raise ValueError(f"{name} keys must be text")
        result[key] = item
    return result


def text(value: object, name: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{name} must be nonempty text")
    return value


def sequence(value: object, name: str) -> list[object]:
    if not isinstance(value, list):
        raise ValueError(f"{name} must be an array")
    return list(value)


def reject_doctype(
    _name: str, _system_id: str | None, _public_id: str | None, _internal_subset: int
) -> None:
    raise ValueError("SVG documents must not contain a DTD or entity declarations")


def validate_svg(path: Path) -> None:
    """Parse well-formed XML while refusing all document type declarations."""
    parser = expat.ParserCreate()
    parser.StartDoctypeDeclHandler = reject_doctype
    parser.SetParamEntityParsing(expat.XML_PARAM_ENTITY_PARSING_NEVER)
    parser.Parse(path.read_bytes(), True)


def validate_sources(root: Path, lesson: dict[str, object], repository: str, revision: str) -> None:
    paths = sequence(lesson.get("source_paths"), "source_paths")
    urls = sequence(lesson.get("source_urls"), "source_urls")
    require(len(paths) == len(urls), "Source path and URL counts differ")
    for path_value, url_value in zip(paths, urls, strict=True):
        source = text(path_value, "source path")
        url = text(url_value, "source URL")
        require(
            "\\" not in source and all(part not in ("", ".", "..") for part in source.split("/")),
            "Source path contains an unsafe component",
        )
        candidate = (root / source).resolve()
        require(candidate.is_relative_to(root), "Source path escapes repository")
        require(candidate.exists(), "Missing source: " + source)
        expected = (
            "https://github.com/" + repository + "/blob/" + revision + "/" + quote(source, safe="/")
        )
        require(url == expected, "Source URL must be a canonical HTTPS GitHub commit link")


def validate_guide(root: Path) -> int:
    root = root.resolve()
    directory = root / "docs/portfolio"
    config = mapping(
        json.loads((directory / "lesson-config.json").read_text(encoding="utf-8")),
        "lesson config",
    )
    repository = text(config.get("repository"), "repository")
    revision = text(config.get("source_revision"), "source_revision")
    require(
        re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9][A-Za-z0-9_.-]*", repository)
        is not None,
        "Repository must be a canonical owner/name pair",
    )
    require(
        re.fullmatch(r"[a-f0-9]{40}", revision) is not None,
        "Source revision must be an immutable full commit SHA",
    )
    lessons = sequence(config.get("lessons"), "lessons")
    require(bool(lessons), "At least one lesson is required")
    ids: set[str] = set()
    for raw_lesson in lessons:
        lesson = mapping(raw_lesson, "lesson")
        identifier = text(lesson.get("id"), "lesson id")
        require(identifier not in ids, "Lesson IDs must be unique")
        ids.add(identifier)
        for field in ("title", "objective", "checkpoint"):
            text(lesson.get(field), field)
        validate_sources(root, lesson, repository, revision)
    validate_svg(root / "assets/portfolio/hero-25d.svg")
    page = (directory / "index.html").read_text(encoding="utf-8")
    embedded = re.search(
        r'<script type="application/json" id="workspaceData">(.*?)</script>', page, re.S
    )
    if embedded is None or json.loads(embedded.group(1)) != config:
        raise ValueError("Guide and canonical JSON disagree")
    require(
        "showModal()" in page and "prefers-reduced-motion" in page,
        "Guide must retain dialog and reduced-motion support",
    )
    return len(lessons)


def main() -> None:
    count = validate_guide(Path(__file__).resolve().parents[2])
    sys.stdout.write(f"{count} source-linked learning paths validated\n")


if __name__ == "__main__":
    main()
