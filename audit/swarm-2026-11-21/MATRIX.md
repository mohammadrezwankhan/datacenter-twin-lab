# Eight-domain capability and acceptance matrix

Source of truth: `AGENTS.md`, `README.md`, `docs/engineering/release-readiness.md`; base `519152b6fb2289607f6bb77ccb24976a537675f0`.

| Domain | Scope-specific observations | Final-head status at authoring |
| --- | --- | --- |
| Repository / reproducibility | Dependency pins and two Python lockfiles exist; offline lock-only and clean installation not executed here | NOT_VERIFIED |
| Physics / BESS / energy | Exact-rational ledger invariant is enforced in Python; documented 100-kWh oracle reconstructed arithmetically; no audit-branch simulation executed | NOT_VERIFIED |
| Browser compute / WASM | Browser JavaScript and optional Pyodide workers documented; no current heap, long-task or served-byte profile | NOT_VERIFIED |
| Frontend / accessibility / scenarios | **DTL-001** baseline schema guard accepts arrays as enum strings; patch and regression test proposed; browser runs pending | NOT_VERIFIED |
| Verification / science | Historical CI and source reference tests exist; no independent Carbon verifier or final-SHA scientific run | NOT_VERIFIED |
| Hosting / SEO / web vitals | Root and /learn/ public HTML readable; Cloudflare Direct Upload documented; no current LCP/INP/CLS metrics | NOT_VERIFIED |
| Security / supply chain | Historical Hardened CI and CodeQL pass; no new full-history local scan or actual hosted CSP response inspection | NOT_VERIFIED |
| CI / governance | Seven workflow files reviewed; protected publishing and PR-only cancellation retained; final PR check receipts pending | NOT_VERIFIED |

**Head-level domain counts at authoring:** PASS 0; FAIL 0; NOT_IMPLEMENTED 0; NOT_APPLICABLE 0; BLOCKED 0; NOT_VERIFIED 8. These are domain-level release-verification verdicts, not a count of individual assertions. Recorded baseline tests and the arithmetic oracle are supporting evidence, not substitutes for final SHA checks.

| Specific capability / statement | Classification | Basis |
| --- | --- | --- |
| Published base-sha CI | PASS | Exact GitHub Action run URLs in BASELINE.md |
| Canonical mathematical prediction | PASS | Recomputed exact arithmetic in PHYSICS-VALIDATION.md |
| Baseline browser enum input-contract check | FAIL | Source guard and Node coercion reproducer; DTL-001 |
| Custom first-party WASM engine | NOT_IMPLEMENTED | No such engine validated; Pyodide is a different runtime |
| Calibrated facility thermal/cooling simulation | NOT_IMPLEMENTED | Electrical core explicitly excludes cooling; separate educational screens are not facility calibration |
| Facility telemetry / actuator controls | NOT_APPLICABLE | Local synthetic educational scope excludes physical controls |
| Independent Gemini Carbon verifier | BLOCKED | Requested Antigravity/Carbon execution unavailable in this environment |
| Current Core Web Vitals field percentiles | NOT_VERIFIED | No RUM or equivalent current field measurements |
| Comprehensive new secrets/CVE scan | NOT_VERIFIED | Historical checks are not a new audit-branch scan |

**Severity status at authoring:** 1 P2 source defect patched on proposed branch, pending integration checks; 0 independently confirmed P0/P1/P3 in the reviewed subset. This is not a declaration that comprehensive scans found no other defects.

## Supplemental gate evidence: CVE in scanner lock

At initial PR SHA `30ae35373009b0724a126d13e5757aaa3009a4a6`, `Security / dependencies` was **FAIL**, due to
`wcmatch 8.5.2` / `CVE-2026-132276` detected in
`.github/security/requirements.txt`. DTL-002 proposes a scoped hashed
scanner dependency update to 11.2. The resulting new SHA is
**NOT_VERIFIED** until the complete applicable security scanner and OpenGrep
contract checks run. The prior eight-domain final-head verdict remains
unverified, with no premature PASS assigned.
