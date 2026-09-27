"""Build the legacy GitHub Pages entry points, separate from the full application."""

import argparse
import html
import json
from pathlib import Path
from urllib.parse import urlparse


def build(site: Path, output: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    destination = json.loads((root / "apps/web/site.config.json").read_text(encoding="utf-8"))["url"]
    parsed = urlparse(destination)
    if parsed.scheme != "https" or not parsed.hostname or parsed.query or parsed.fragment:
        raise ValueError("Expected a public HTTPS destination without query or fragment")
    if parsed.username or parsed.password or not destination.endswith("/"):
        raise ValueError("Destination must end in / and have no credentials")
    if not (site / "index.html").is_file():
        raise ValueError("Build the complete browser site first")
    output.mkdir(parents=True, exist_ok=False)
    script = r"""
const target = new URL(DESTINATION);
const prefix = '/datacenter-twin-lab/';
const path = window.location.pathname;
if (path.startsWith(prefix)) {
  // Set pathname rather than resolving a user-controlled URL: keep the fixed origin.
  target.pathname += path.slice(prefix.length).replace(/^\/+/, '');
}
target.search = window.location.search;
target.hash = window.location.hash;
window.location.replace(target.href);
""".replace("DESTINATION", json.dumps(destination).replace("<", "\\u003c"))
    pages = [*site.rglob("index.html"), site / "404.html"]
    for source in pages:
        relative = source.relative_to(site)
        page_path = relative.parent.as_posix()
        suffix = "" if page_path == "." else page_path + "/"
        canonical = html.escape(destination + suffix, quote=True)
        document = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Datacenter Twin Lab has moved</title>
<link rel="canonical" href="{canonical}">
<script>{script}</script>
<noscript><meta http-equiv="refresh" content="0;url={canonical}"></noscript>
<meta name="description" content="The Datacenter Twin Lab course is now at khanlab.co.technology.">
</head><body><main><h1>Datacenter Twin Lab has moved</h1>
<p><a href="{canonical}">Continue to the course at khanlab.co.technology</a>.</p>
</main></body></html>
"""
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(document, encoding="utf-8", newline="\n")
    for name in ("robots.txt", "sitemap.xml", ".nojekyll"):
        (output / name).write_bytes((site / name).read_bytes())
    print(f"Prepared {len(pages)} legacy entry points for {destination}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    build(args.site, args.output)
