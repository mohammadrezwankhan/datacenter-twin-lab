# Prioritized evidence-gated follow-up work

1. **Before merging this PR (mandatory):** run `python scripts/check_dependency_versions.py --lock-only api test-api studies`, Python tests, exact browser-engine type/format/build, Python-vs-JavaScript scenario parity, QA browser journeys, security jobs and CodeQL on final SHA. Inspect all result links, skipped statuses and changed-file diff. Seek independent scientific/implementation review; no Gemini Carbon worker was available in this session.
2. **Browser and production truth:** capture viewport/zoom screenshots, axe output, memory/worker profiles, JS/Pyodide compressed served asset sizes, route status codes, actual CSP and field/lab CWV separately. Trigger the existing hosted crawler manually only with owner approval and exact scope.
3. **Scientific independent verification:** implement an out-of-engine ledger oracle over exported interval decimals; record absolute and scale-relative residuals and exact tolerances. Obtain an independent reviewer receipt; authored CI tests alone are not external validation.
4. **Optional thermal/cooling design (not part of this patch):** require licensed facility boundary data, HVAC/rack heat capacities, water and coolant paths, initial conditions and independent thermal transients before introducing a validated thermal solver. Separate educational examples from facility simulation.
5. **Optional first-party WASM/worker optimization:** profile actual use and JS/Pyodide payloads before proposing another engine; document transfer ownership, fallback behavior, cross-origin isolation and cost/benefit. Do not impose a 500 KB cap on Pyodide.
6. **Standards and calibration:** build clause-to-feature evidence and obtain proper rights, provenance and qualified reviews before any ASHRAE, IEC 62040, Uptime Tier or facility-accuracy claim.

7. **New PR security gate:** verify patched `wcmatch==11.2` is accepted by
   the hash-locked Python 3.12 scanner bootstrap and all OpenGrep rule/coverage
   checks, despite the upstream OpenGrep 1.33.1 `~=8.3` preference. If
   mismatched, preserve fail-closed behavior and plan an upstream-supported
   scanner upgrade instead of suppressing CVE-2026-132276.
