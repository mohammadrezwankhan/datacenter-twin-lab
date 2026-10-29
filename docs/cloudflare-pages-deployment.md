# Cloudflare Pages deployment and indexing

Project: datacenter-twin-lab. Account: 6aeaea77d967e029f75b0f66107c507b.
Production: https://khanlab.co.technology/ . Production branch: main.

This project uses Direct Upload. Git pushes alone do not deploy it. Keep the
existing Pages project; use the validated build and pinned Wrangler 4.149.0.

## Build

From the repository root in PowerShell:

```powershell
.\.venv\Scripts\python.exe scripts\prepare_browser_demo.py
$env:VITE_PUBLIC_SOURCE_REVISION = (git rev-parse HEAD).Trim()
npm.cmd --prefix apps/web run build:demo
```

Run the search-page checks before deploying:

```powershell
cd apps/web
npx.cmd playwright test --config playwright.demo.config.ts search-pages.spec.ts
```

## Deploy

Authenticated Wrangler:

```powershell
node .local/deployment-tools/node_modules/wrangler/bin/wrangler.js login
python C:\Users\MRK\Documents\misce\deploy_khanlab_pages.py --site-dir .local/browser-demo-site
```

For a Pages Edit API token, set CLOUDFLARE_API_TOKEN securely in the process
environment or use the hidden prompt (never paste it into chat):

```powershell
python C:\Users\MRK\Documents\misce\deploy_khanlab_pages.py --prompt-token --site-dir .local/browser-demo-site
```

The API path gets the short-lived token using GET, uploads assets, submits
multipart manifest plus _headers and _redirects, and polls deployment completion.
Do not substitute JSON for the multipart deployment request. Do not blindly
retry an ambiguous creation timeout; inspect deployment history first.

For Dashboard upload, select the complete validated site folder, including
_headers, _redirects and 404.html. The original outputs/releases/v2.0.0/site
folder is a historical build, not automatically refreshed by the build command.

## Robots and Search Console

A separate ecosystem-robots-policy Worker owns the exact custom-domain route
khanlab.co.technology/robots.txt. Pages uploads do not replace this response.
The production policy permits crawling of canonical public routes and advertises
the sitemap; it also disallows query-string variants and `/404` paths. Local
source and generated robots files have the same broad exclusions. When a URL is
disallowed, a crawler cannot fetch that URL's canonical or `noindex` metadata.

Do not add query-string or 404 exclusions solely to clear indexing reports.
Keep genuine missing pages as HTTP 404. The dedicated 404 template has
`noindex` and is excluded from the sitemap. Review a specific Search Console
diagnostic before changing the existing Worker exclusions; a robots-blocked
URL cannot expose its canonical or `noindex` directive to the crawler.

After a successful deployment, use the authenticated Search Console property:

- Submit https://khanlab.co.technology/sitemap.xml.
- Inspect affected real pages and compare user-declared and Google-selected
  canonicals. Request indexing of corrected canonical pages where appropriate.
- Validate duplicate-canonical or unintended 404 issues only after reviewing
  their affected URLs. Do not validate all exclusions indiscriminately.
- Use the robots.txt report and live URL inspection for actual affected pages
  to confirm crawl access. Indexing reports can lag deployment and recrawling.

References:
https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
https://developers.google.com/search/docs/crawling-indexing/block-indexing
https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls

## Production crawl-policy ownership and observed tradeoff

A read-only production check on 2026-10-28 confirmed that `https://khanlab.co.technology/robots.txt` is served as a 200 `text/plain` response by the separate `ecosystem-robots-policy` Worker. Cloudflare Pages Direct Uploads and `apps/web/public/robots.txt` do not replace that custom-domain response. Keep all user-agent groups, allow rules, and the sitemap reference in the Worker policy as currently configured unless an indexing diagnosis justifies a reviewed policy change.

The observed Worker policy allows canonical public content and advertises `https://khanlab.co.technology/sitemap.xml`; it disallows query-string URLs and `/404` and `/404.html`. The live XML sitemap returned 200 `application/xml`, contained 30 canonical HTTPS routes, and each listed route returned 200 in the audit. The sitemap excludes the genuine missing-path response, which returned HTTP 404. This confirms crawl access to the listed static canonical pages; it does not establish an indexing outage.

Query routes such as `/?mode=emt` and `/?study=load-step` returned 200 in direct requests and declare the root URL as canonical, but the current robots policy disallows fetching them. A robots-blocked URL cannot expose its HTML canonical or `noindex` directive to a crawler. The public course and study reading pages remain available at their canonical paths. Keep this tradeoff documented and unchanged by default; if Search Console or another indexing report identifies a specific problem, review whether that route needs to be crawlable before changing the Worker policy. Likewise, keep `/404` exclusions unless a concrete diagnostic requires a crawler to read the 404 template. No Worker or account configuration was changed by the audit.
