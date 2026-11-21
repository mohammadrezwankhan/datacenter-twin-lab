# GitHub Actions and governance inventory

At `519152b6fb2289607f6bb77ccb24976a537675f0` the seven workflow files are `tests.yml`, `hardened-ci.yml`, `qa-audit.yml`, `codeql.yml`, `deploy-dashboard.yml`, `publish-pypi.yml`, and `portfolio-dashboard-check.yml`. **No CI files are modified by this PR.**

- Tests: Python 3.12 and 3.14 on Windows/Ubuntu; macOS native reader; browser demo and Python parity; build/evidence verification. Lock-only dependency validation precedes downloads.
- Hardened CI: five security modes, seven language quality modes, with versioned uploads.
- Audit quality gates: PR parity, responsive/demo and browser evidence; hosted live crawler is explicitly manual.
- PR concurrency groups cancel superseded PR runs only. Default branch and publishing/deploy protections remain.
- `deploy-dashboard.yml` validates the `docs/` artifact; its deploy job is explicitly disabled (`if: false`). `docs/cloudflare-pages-deployment.md` states that the custom domain uses authenticated Direct Upload and Git pushes alone do **not** publish it.
- PyPI workflow is manual, gated to `main`, successful full CI for exact source and trusted publisher OIDC. No release initiated.

Last observed 2026-11-19 base-SHA status: [Tests](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44641661298), [Hardened CI](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44641661527), [CodeQL](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44641661302), [Flagship dashboard](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44641661317) all completed success as workflows. The dashboard deployment job was skipped.

**NOT_VERIFIED:** final-head PR checks, required-protection/ruleset enforcement details, before/after elapsed CI runtime, billed minutes, cache hit rates, and claimed CI savings. No optimization or savings are asserted.
