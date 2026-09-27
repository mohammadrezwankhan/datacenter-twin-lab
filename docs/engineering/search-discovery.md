# Search and answer-engine discovery

The static course has fifteen indexable pages: the working simulator, a course index, twelve original lesson notes, and an author/evidence page. Every lesson is readable without JavaScript and links to its live experiment, starting/challenge configuration, worked answer and exact source. The pages reuse the live lesson definitions and prepared scenarios so the searchable explanation cannot quietly become a different model.

The build emits unique titles/descriptions, canonical URLs, Open Graph/Twitter previews, visible author attribution, `WebSite`, `SoftwareApplication`, `Course`, `LearningResource`, `AboutPage` and breadcrumb JSON-LD, `sitemap.xml`, `robots.txt`, and a noindex missing-page document. No ratings, awards, third-party review, accreditation or facility guarantees are asserted. Notes use lightweight local CSS and an original inline calculation diagram; they do not download the Python runtime or dashboard bundle.

## Canonical host and mirrors

`apps/web/site.config.json` records the verified primary URL. A reviewed build can override it with `VITE_PUBLIC_SITE_URL`, which must be an HTTPS URL without credentials, query or fragment. Use a trailing slash. The same canonical value feeds HTML, structured data, previews and the sitemap. Internal links remain relative so the artifact works at an origin root and at the GitHub repository subpath.

The primary host is `https://khanlab.co.technology/`, verified over HTTPS before changing the configuration. Search engines choose their own canonical; the tag is a signal, not a forced result. On GitHub project Pages, the repository's `robots.txt` is below the origin root, so it does not govern the entire `github.io` host. At the custom-domain root it is the host's robots file.

The owner requested old website links to forward to the primary host. `scripts/build_pages_redirect.py` creates a **separate** GitHub Pages artifact. Its JavaScript forwarding preserves the path, query and fragment on the fixed destination origin. Known static lesson pages also have a no-JavaScript meta-refresh and a visible link. GitHub Pages serves static forwarding documents, not configurable HTTP 301 rules. The complete tested app is retained in the `public-browser-bundle` CI artifact for Cloudflare and release downloads; never upload the forwarding artifact to Cloudflare or it would loop. Source-code, issue and release URLs on `github.com` remain repository URLs.

The CI source revision pins source links in generated notes. A local release build without that environment value links to its version tag. Both point to public material only; no private planning or campaign records enter the generated site.

## GEO means useful, inspectable answers

Each lesson states a specific question, an answer with units, explicit assumptions and reproduction links. The author/evidence page distinguishes measured software behavior from physical validation. This makes the content easier for a person or retrieval system to quote accurately. No hidden crawler-only copy, keyword stuffing, invented authority, or model instructions are present.

Google's [AI search guidance](https://developers.google.com/search/docs/appearance/ai-features) says its existing SEO practices also apply to AI features; special AI files or special schema are not prerequisites. Consequently this site does not claim an `llms.txt` file, schema markup or any other change guarantees an AI citation. Indexing, ranking and answer-engine inclusion remain unverified until there is actual evidence.

## Verification and measurement

`npm --prefix apps/web run test:demo -- --grep "search pages"` exercises all twelve lessons with JavaScript disabled, checks all fifteen canonical URLs against the sitemap and metadata, inspects structured data, checks phone layout/accessibility and follows a lesson into the live calculation. The same checks run at the repository subpath and origin root. Existing numerical, parity, first-result payload and package tests remain required.

After deployment, check anonymous status codes, HTML, canonical URLs, sitemap and image delivery. A real missing URL must return 404; do not use an all-path SPA rewrite for the static notes. Search Console/Bing site verification requires the selected owner's supported account access; no account or verified property is claimed here. Search impressions, organic clicks, AI citations and conversions remain unknown until obtained through an authorized source. Do not infer them from test traffic or downloads.

Primary references checked 27 September 2026: [helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [AI features](https://developers.google.com/search/docs/appearance/ai-features), [canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), and [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview).
