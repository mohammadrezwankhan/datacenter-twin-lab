# Search Console indexing repair, 2026-10-15

Search Console listed 31 alternate simulator query URLs, one missing v1.0.0
evidence JSON, seven crawled JSON data URLs and seven discovered lesson pages.
The live property had no active Google-selected-canonical or noindex issue rows.

The browser build copied only the current evidence packet, dropping older public
URLs on upgrades. Keep every versioned, manifest-declared packet in the browser
build. Verify each artifact against its existing SHA-256 before copying. Preserve
the version and bytes; never redirect a v1 result to a numerically different v2
result. The current evidence index continues to select the current engine.

The production repair adds 60 historical files to the exact deployed 424cf534
browser bundle, retaining the existing 164 asset hashes, headers, redirects and
application behavior. Verify every restored file against the repository bytes.

Simulator query links intentionally canonicalize to the application root. The
24 separate reading pages have self-referential canonicals and are in the sitemap.
Do not redirect simulator links or make them independently indexable merely to
clear the alternate-page report. JSON datasets need not appear in web search.
Preview pages.dev hosts and the real 404 template intentionally remain noindex.

Validation: public evidence history tests; existing evidence package tests;
public site audit tests; live crawl of 30 HTML pages, 24 lessons, 38 linked files
and 14 current evidence artifacts. The non-strict audit has zero failures and
54 pre-existing advisory warnings about schema types and missing lastmod dates.
Lastmod must reflect actual content changes; do not fabricate dates to force
recrawling. Google controls canonical selection and indexing after recrawling.
