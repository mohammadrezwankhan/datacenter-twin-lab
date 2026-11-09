# Quality Report — 2026-11-09 source remediation candidate

**Scope:** Evidence-limited engineering-quality patch for `mohammadrezwankhan/datacenter-twin-lab`, based on the 2026-11-09 main baseline `2bcf770a244d1b580b812bd66d8640d33a81e22a`. This is **not** a v2.0.2 release receipt or facility validation.

## Verified baseline (before the patch)

- GitHub repository reports zero open PRs, six open issues and latest published release [v2.0.1](https://github.com/mohammadrezwankhan/datacenter-twin-lab/releases/tag/v2.0.1).
- [Hardened CI, 2026-11-09](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/42656884116) completed successfully on baseline SHA `2bcf770a`.
- [CodeQL, 2026-11-09](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/42668389684) completed successfully on the same SHA.
- Existing `apps/web/tests-demo/viewport-matrix.audit.spec.ts` covers 13 viewport profiles with no-root-overflow, touch-target, table-containment, page-error and same-origin HTTP-failure assertions. This patch adds four explicitly requested viewport sizes. No before/after screenshot claim is made.

## Source-derived findings and targeted changes

1. **Metadata correctness:** `apps/web/index.html` contained fallback 12-lesson wording, engine 1.0.0 and descriptions of inverter/ATS/generator behavior beyond the bounded teaching models. The current `apps/web/src/course-catalog.json` defines 24 lessons. Update fallback JSON-LD to match the catalog and current 2.0.1 engine version. The demo build continues to generate its canonical metadata from `apps/web/seo.ts`.
2. **README information architecture:** The top of `README.md` made the separate four-module offline companion appear to be the primary course. Distinguish it from the 24-lesson flagship and 18 synthetic scenarios; state the canonical charging-disabled 1 MW/100 kWh result as 307.8 seconds after the outage and 607.8 seconds elapsed.
3. **Regression safety:** Add a source metadata regression test to the existing engine test suite. Extend, rather than replace, the existing Playwright viewport matrix.

## Evidence and release limitations

- This patch does **not** modify Python or JavaScript calculation equations, scenario fixtures, Web API concurrency, deployment credentials, source release assets or scientific tolerances.
- Source metadata was re-read and parsed as JSON-LD; the 24-lesson catalogue length and four viewport additions were checked against the branch. These are focused static checks, **not** a complete TypeScript, browser, security or release suite.
- The complete Python, Node, browser, SAST, secret-history and production-crawl gates must be checked on the exact proposed commit before declaring a comprehensive release. GitHub Actions receipts should be attached to the PR. No unexecuted test counts are claimed here.
- [Cloudflare Pages deployment instructions](docs/cloudflare-pages-deployment.md) explicitly state that GitHub pushes do **not** deploy the custom domain: the project uses authenticated Direct Upload. GitHub Pages forwarding and Cloudflare production publication are separate operations.
- The educational source content retains **Research alpha**, synthetic/uncalibrated model scope, Engineering HOLD and no physical control or certified uptime claims.
