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
