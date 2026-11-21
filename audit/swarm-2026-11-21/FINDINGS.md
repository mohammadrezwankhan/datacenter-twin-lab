# Evidence-backed findings

## DTL-001 — Browser validator coerces topology enums (P2, confidence high)

- **Files/lines at base:** `apps/web/src/js-engine/contract.ts:53–59` and `:71–76`.
- **Root cause:** `String(kind)` and `String(relation)` in a membership test accept arrays such as `["distribution"]` and `["feeds"]`, although later logic compares those fields using strict string equality.
- **Reproducer executed in Node v22.16.0:** `['distribution'].toString() === 'distribution'` and `['feeds'].toString() === 'feeds'` evaluate true. Direct evaluation of both baseline guards returned true even though each input was an array and strict equality against the expected string was false.
- **Impact:** A user-imported schema-2 JSON could bypass part of the browser enum contract, silently omit a feed when a redundant path masks the malformed relation, or diverge from strict Python validation. No claim that a deployed user has encountered this case.
- **Patch:** require `typeof kind === 'string'` and `typeof relation === 'string'` before enum membership; do not loosen topology rules or numeric tolerances.
- **Regression:** `apps/web/tests-engine/engine.test.ts` new test `topology validation rejects arrays masquerading as valid enum strings`: modifies the `path-a` distribution kind and the `main-bus` → `path-a` feed relation to arrays, asserting informative contract rejection.
- **Verification:** source-level regression scenario designed and exact JavaScript guard reproduced; `npm run test:engine`, full PR CI, browser parity and independent Carbon sign-off **PENDING / NOT_VERIFIED** at authoring.
- **Owner:** scenario contract remediation; **external independent verifier:** not assigned (Carbon unavailable).
- **Status:** PATCH WRITTEN; final-SHA CI required.

No false positives are reported as confirmed critical vulnerabilities. Additional source observations (e.g. permissive static CSP `'unsafe-eval'`) are research/hosting-review questions until actual runtime and risk are verified.

## DTL-002 — Vulnerable hash-locked scanner dependency blocks CI (P2, confidence high)

- **Source:** `.github/security/requirements.in` and `requirements.txt`; historical pin `wcmatch~=8.3`, resolved `wcmatch==8.5.2`.
- **Reproduction:** first PR Hardened CI SHA `30ae35373009b0724a126d13e5757aaa3009a4a6`, [Security / dependencies failure](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44957669592/job/137009255442). Retrieved and decoded the job artifact `security-dependencies-44957669592-1`: `pip-requirements-2.json` identifies `wcmatch 8.5.2`, `CVE-2026-132276`, fixed version 11.2. The scanner returned exit 1, with every other requirements manifest and npm audit passing in that job.
- **Impact:** a moderate untrusted-file-name pattern-matching denial of service in the CI scanner environment, and a mandatory failing dependency-security gate. No evidence that the application engine imports the affected scanner library.
- **Root cause:** pinned OpenGrep 1.33.1 Python tooling retained a historical `wcmatch~=8.3` compatibility constraint, which cannot select fixed 11.2.
- **Fix proposal committed:** narrow scanner-only exception `wcmatch==11.2`; official PyPI-attested wheel/sdist SHA-256 hashes; preserve `bracex==3.2.1` which satisfies upstream 11.2's `bracex>=3.2`. No suppression or guard removal.
- **High-risk compatibility boundary:** jump from 8.x to 11.x crosses upstream OpenGrep's declared dependency range. Requalify security scanner functions, authored-file selection, rule coverage and bootstrap. No general claim of OpenGrep upstream compatibility until checks pass.
- **Verifier:** full PR security/bootstrap jobs on final SHA required; independent Gemini Carbon review unavailable.
- **Status:** PATCH WRITTEN; final-SHA scanner CI **PENDING**.

## DTL-003 — OpenGrep metadata conflicts with fixed wcmatch (P1 release blocker)

Second head `10a81523c1692cdf000e17a851933e6d96f3e14a` [Security / sast](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44958030374/job/137010374800) **FAILED** at bootstrap: `pip check` reported `opengrep 1.33.1 has requirement wcmatch~=8.3, but you have wcmatch 11.2`. The dependency audit on that SHA passed, but wheel metadata was incompatible. Proposed fix patches one `cli/setup.py` dependency in this custom-built OpenGrep wheel, with pinned upstream preimage, patch bytes and postimage SHA-256, source scope inventory and new globfilter/metadata qualification. All full SAST/AST/CLI tests and `pip check` remain mandatory. Release blocked until this compatibility test passes; no CVE exemption or scanner bypass.
