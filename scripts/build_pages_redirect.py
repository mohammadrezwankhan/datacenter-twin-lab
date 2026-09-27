"""Build the legacy GitHub Pages entry points, separate from the full application."""

import argparse
import html
import json
import os
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
    # Hashed evidence names can exceed MAX_PATH in a nested Windows checkout.
    # Use extended filesystem syntax without changing operating-system policy.
    if os.name == "nt":
        absolute = os.path.abspath(output)
        if not absolute.startswith("\\\\?\\"):
            absolute = "\\\\?\\UNC\\" + absolute[2:] if absolute.startswith("\\\\") else "\\\\?\\" + absolute
        output = Path(absolute)
    output.mkdir(parents=True, exist_ok=False)
    # Keep public media/download URLs usable in older posts and cached clients.
    # Only HTML entry points change; the input is the already allowlisted build.
    for source in site.rglob("*"):
        if source.is_symlink():
            raise ValueError("Static assets must not contain symbolic links")
        if source.is_file():
            target = output / source.relative_to(site)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(source.read_bytes())
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
    pages = list(site.rglob("*.html"))
    for source in pages:
        relative = source.relative_to(site)
        page_path = relative.parent.as_posix()
        if relative.name == "index.html":
            suffix = "" if page_path == "." else page_path + "/"
        else:
            suffix = "" if relative.name == "404.html" else relative.as_posix()
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
