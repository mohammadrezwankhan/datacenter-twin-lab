# Baseline inventory — 2026-11-21

- Repository: https://github.com/mohammadrezwankhan/datacenter-twin-lab
- Read-only baseline branch: `main`
- Base SHA: `519152b6fb2289607f6bb77ccb24976a537675f0` (commit recorded 2026-11-19 23:55:36 UTC).
- Audit branch: `audit/datacenter-carbon-20261121-519152b6` (independent; no existing work overwritten).
- Remote tracked-tree cleanliness: read from GitHub; no local working tree was available to inspect. **NOT_VERIFIED** for an on-disk clean checkout.
- Execution environment used for the isolated type-guard reproduction: Node v22.16.0 and Python 3.13.5, Linux container. The container cannot resolve github.com, so this is **not** the project's supported Node 24 / Python 3.12–3.14 full test environment.
- Gemini 4 Carbon/Antigravity `/swarm` agent execution and independent Carbon verifier: **UNAVAILABLE**, and therefore not claimed.

## Product and model inventory

Read `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `pyproject.toml`, `QUALITY_REPORT.md`, `docs/canonical-case.md`, `docs/engineering/browser-demo.md`, `docs/cloudflare-pages-deployment.md`, and current workflow source at this SHA. Python core: `datacenter_twin/continuity.py`, `topology.py`, `contracts.py`; CLI, loopback API and JS browser engine are separate surfaces. The public course contains 24 lessons (12 continuity, 12 infrastructure), one separate EMT and five power-dynamics studies; the 18 scenario presets are a separate catalog. A four-module `docs/` companion is not the whole course.

`apps/web/src/javascript-worker.ts` runs the first-result JavaScript engine off-main-thread; optional Python verification uses a separate Web Worker and pinned Pyodide, not a proven first-party custom WASM solver. The electrical continuity core excludes calibrated thermal/cooling and operational control. Engineering HOLD and uncalibrated synthetic boundaries remain authoritative.

## Recorded baseline workflow receipts

At `519152b6fb2289607f6bb77ccb24976a537675f0`, completed successfully 2026-11-19:
- [Tests](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44641661298): seven jobs (Python 3.12/3.14 × Windows/Linux, macOS native reader, browser/Python parity, and a skipped static publish job; six successes and one skip).
- [Hardened CI](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44641661527): 12/12 jobs successful, including security and language quality.
- [CodeQL](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44641661302): Python and JavaScript/TypeScript analysis jobs successful.
- [Flagship dashboard](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44641661317): validate successful, deploy skipped by policy.

These results are **FROM_GITHUB at the baseline SHA**, not checks executed on the audit branch. Live read-only HTML was retrievable from `https://khanlab.co.technology/` and `/learn/`; client scripts, response headers, SPA navigation and deployment provenance were not independently exercised.

## Files changed by this audit

Only the JavaScript scenario enum validator, a focused test, and this new evidence folder. No dependency lock, numerical equation, historic release record, GitHub workflow or production deployment was altered.
