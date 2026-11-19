"""Render only the static handbook from canonical Markdown/CFF and a fixed manifest."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import posixpath
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / "docs/reference"
OUTPUT = DIRECTORY / "index.html"
VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "source",
    "wbr",
}


def chapter_id(path: str) -> str:
    """Give every chapter a stable, repository-relative anchor namespace."""
    return re.sub(r"[^a-z0-9]+", "-", str(Path(path).with_suffix("")).lower()).strip("-")


class ChapterLinks(HTMLParser):
    """Rewrite document links for the single-page guide; reject active HTML."""

    def __init__(self, path: str, chapters: dict[str, str], source_url: str) -> None:
        super().__init__(convert_charrefs=False)
        self.path = path
        self.chapters = chapters
        self.source_url = source_url
        self.parts: list[str] = []
        self.anchor_depth = 0

    def rewrite_url(self, value: str) -> str:
        url = urlsplit(value)
        if url.scheme or url.netloc or not url.path:
            return value
        target = posixpath.normpath(posixpath.join(posixpath.dirname(self.path), unquote(url.path)))
        if target == ".." or target.startswith("../") or target.startswith("/"):
            raise ValueError(f"Link escapes the repository: {self.path}: {value}")
        if target in self.chapters:
            anchor = self.chapters[target]
            return "#" + anchor + ("-" + url.fragment if url.fragment else "")
        if target == "docs/reference/index.html":
            return "#" + (url.fragment or "top")
        if not (ROOT / target).exists():
            raise ValueError(f"Missing local destination: {self.path}: {value}")
        suffix = ("?" + url.query if url.query else "") + (
            "#" + url.fragment if url.fragment else ""
        )
        if target.startswith("docs/"):
            return posixpath.relpath(target, "docs/reference") + suffix
        return self.source_url + quote(target, safe="/") + suffix

    def can_embed_image(self, value: str) -> bool:
        """Keep only CSP-permitted embedded data or existing published image files."""
        url = urlsplit(value)
        if url.scheme in {"data", "blob"}:
            return True
        if url.scheme or url.netloc or not url.path:
            return False
        destination = (DIRECTORY / unquote(url.path)).resolve()
        return (
            destination.is_relative_to(ROOT / "docs")
            and destination.is_file()
            and destination.suffix.lower()
            in {".avif", ".gif", ".ico", ".jpeg", ".jpg", ".png", ".svg", ".webp"}
        )

    def image_fallback(self, source: str, alternative: str) -> None:
        """Expose a readable alternative without nesting links or loading remote media."""
        label = html.escape(alternative.strip() or "Unlabelled image")
        if self.anchor_depth:
            self.parts.append(f"<span>Image: {label}</span>")
        elif source and urlsplit(source).scheme in {"", "http", "https"}:
            self.parts.append(
                f'<a href="{html.escape(source, quote=True)}">Image source: {label}</a>'
            )
        else:
            self.parts.append(f"<span>Image: {label}</span>")

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "iframe", "object", "embed", "form"}:
            raise ValueError(f"Active HTML is not allowed in a handbook chapter: {tag}")
        rendered = []
        rewritten = {}
        for key, value in attrs:
            if key == "style":
                # Pandoc may add table-column widths; presentation belongs in reference.css.
                continue
            if key.lower().startswith("on"):
                raise ValueError(f"Event attributes are not allowed in chapters: {key}")
            if key in {"href", "src"} and value:
                value = self.rewrite_url(value)
            rewritten[key] = value
            rendered.append(key if value is None else f'{key}="{html.escape(value, quote=True)}"')
        if tag == "img" and not self.can_embed_image(rewritten.get("src") or ""):
            self.image_fallback(rewritten.get("src") or "", rewritten.get("alt") or "")
            return
        if tag == "a":
            self.anchor_depth += 1
        if tag == "table":
            self.parts.append(
                '<div class="table-scroll" tabindex="0" role="region" '
                'aria-label="Scrollable reference table">'
            )
        attributes = " " + " ".join(rendered) if rendered else ""
        self.parts.append(f"<{tag}{attributes}>")

    def handle_endtag(self, tag: str) -> None:
        if tag == "a":
            self.anchor_depth = max(0, self.anchor_depth - 1)
        if tag not in VOID_TAGS:
            self.parts.append(f"</{tag}>")
        if tag == "table":
            self.parts.append("</div>")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def handle_entityref(self, name: str) -> None:
        self.parts.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self.parts.append(f"&#{name};")

    def handle_comment(self, data: str) -> None:
        self.parts.append(f"<!--{data}-->")


def run(command: list[str], content: str | None = None) -> str:
    """Invoke only declared local rendering tools without a shell."""
    result = subprocess.run(  # noqa: S603 - fixed local tools, no shell or user command text
        command, cwd=ROOT, input=content, text=True, capture_output=True, check=True
    )
    return result.stdout


def render() -> str:
    manifest_path = DIRECTORY / "chapters.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    source_sha = manifest["source_sha"]
    if not re.fullmatch(r"[0-9a-f]{40}", source_sha):
        raise ValueError("The chapter manifest needs a full source SHA")
    repository = manifest["repository"]
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Invalid repository identity")
    chapters: list[dict[str, str]] = manifest["chapters"]
    ids = {item["path"]: chapter_id(item["path"]) for item in chapters}
    if len(ids) != len(chapters) or len(set(ids.values())) != len(ids):
        raise ValueError("Chapter paths and anchors must be unique")
    source_url = f"https://github.com/{repository}/blob/{source_sha}/"
    inputs = []
    articles = []
    groups: dict[str, list[str]] = {}
    for item in chapters:
        path = item["path"]
        resolved = (ROOT / path).resolve()
        if not resolved.is_relative_to(ROOT) or resolved.suffix not in {".md", ".cff"}:
            raise ValueError(f"Invalid chapter path: {path}")
        content = resolved.read_text(encoding="utf-8")
        inputs.append({"path": path, "sha256": hashlib.sha256(resolved.read_bytes()).hexdigest()})
        if resolved.suffix == ".cff":
            content = (
                "# Citation metadata\n\nExisting CFF, preserved verbatim:\n\n```yaml\n"
                + content
                + "```\n"
            )
        fragment = run(
            [
                "pandoc",
                "--from=gfm+tex_math_dollars+yaml_metadata_block",
                "--mathml",
                "--to=html5",
                "--wrap=none",
                "--no-highlight",
                "--shift-heading-level-by=1",
                "--id-prefix=" + ids[path] + "-",
            ],
            content,
        )
        parser = ChapterLinks(path, ids, source_url)
        parser.feed(fragment)
        parser.close()
        articles.append(
            f'<section class="chapter" id="{ids[path]}">'
            + "".join(parser.parts)
            + '<p class="chapter-source">Canonical file: <code>'
            + html.escape(path)
            + '</code> · <a href="#top">Back to guide navigation</a></p></section>'
        )
        groups.setdefault(item["group"], []).append(
            f'<li><a href="#{ids[path]}">{html.escape(item["label"])}</a></li>'
        )
    navigation = "".join(
        '<div class="nav-group"><strong>'
        + html.escape(group)
        + "</strong><ul>"
        + "".join(items)
        + "</ul></div>"
        for group, items in groups.items()
    )
    inputs.extend(
        {
            "path": path.relative_to(ROOT).as_posix(),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
        for path in (manifest_path, Path(__file__), DIRECTORY / "reference.css")
    )
    metadata = json.dumps(
        {
            "source_sha": source_sha,
            "reviewed": manifest["reviewed"],
            "pandoc": run(["pandoc", "--version"]).splitlines()[0],
            "inputs": inputs,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    title = html.escape(manifest["title"])
    return (
        '<!doctype html>\n<html lang="en">\n<head>\n'
        '<meta http-equiv="Content-Security-Policy" content="'
        "default-src 'none'; base-uri 'none'; object-src 'none'; form-action 'none'; "
        "script-src 'self'; script-src-attr 'none'; style-src 'self'; style-src-attr 'none'; "
        "img-src 'self' data: blob:; font-src 'self'; media-src 'self'; frame-src 'self'; "
        "connect-src 'self'; worker-src 'self'; manifest-src 'self'\">\n"
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
        '<meta name="color-scheme" content="dark light">\n'
        '<meta name="description" content="Source-backed native models, equations, '
        'reproducibility and owner guidance.">\n'
        f'<title>{title}</title>\n<link rel="stylesheet" href="reference.css">\n</head>\n<body>\n'
        '<a class="skip-link" href="#content">Skip to reference content</a>\n'
        '<header class="site-header" id="top"><a class="brand" href="../index.html">'
        'Datacenter Twin Lab</a>'
        '<nav aria-label="Site navigation"><a href="../index.html">Interactive lab</a>'
        '<a href="../native-lessons.html">Native lessons</a>'
        '<a href="../INDEX.md">Markdown index</a></nav></header>\n'
        '<div class="layout"><aside class="sidebar"><nav aria-label="Reference chapters">'
        + navigation
        + '</nav></aside>\n<main id="content">'
        f'<header class="guide-intro"><h1>{title}</h1>'
        "<p>Inspect the model equations, reproduce the examples, and distinguish software evidence "
        'from external review and facility validation.</p><p class="snapshot">Reviewed '
        + html.escape(manifest["reviewed"])
        + ' · Source <a href="https://github.com/'
        + repository
        + "/tree/"
        + source_sha
        + '"><code>'
        + source_sha[:12]
        + "</code></a>. This is a dated documentation snapshot.</p></header>"
        '<details class="mobile-contents"><summary>Browse reference chapters</summary>'
        '<nav aria-label="Reference chapters on small screens">'
        + navigation
        + "</nav></details>"
        + "\n".join(articles)
        + "<footer><p>This reading view is generated from canonical Markdown and the existing CFF. "
        "Use <code>python docs/reference/build_reference.py --check</code> to check freshness. "
        "The snapshot date is not a release or deployment receipt.</p></footer></main></div>\n"
        "<!-- handbook-inputs " + metadata + " -->\n</body>\n</html>\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", action="store_true", help="Compare generated HTML without writing"
    )
    args = parser.parse_args()
    try:
        result = render()
        if args.check:
            if not OUTPUT.is_file() or OUTPUT.read_text(encoding="utf-8") != result:
                sys.stderr.write(
                    "Reference HTML is stale; run python docs/reference/build_reference.py\n"
                )
                return 1
            sys.stdout.write("Reference HTML matches all canonical inputs.\n")
        else:
            OUTPUT.write_text(result, encoding="utf-8")
            sys.stdout.write("Rendered docs/reference/index.html from canonical inputs.\n")
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        sys.stderr.write(f"Reference rendering failed: {error}\n")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
