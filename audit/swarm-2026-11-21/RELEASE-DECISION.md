# Release decision — 2026-11-21 initial branch evidence

**NOT RELEASE READY / REVIEW REQUIRED** at writing time. Base SHA: `519152b6fb2289607f6bb77ccb24976a537675f0`. Proposed branch: `audit/datacenter-carbon-20261121-519152b6`. Final branch commit and PR checks must be added only after the remote commit/PR is created and verified.

Scoped proposed change: JavaScript browser scenario validation rejects array-typed asset kinds and dependency relations; one focused test asserts these rejection cases. Numerical core, existing tolerance, build/deploy workflows, historical tags/evidence and production are not modified.

## Gate register

| Gate | Decision |
| --- | --- |
| Exact base / isolated branch | Verified from GitHub |
| DTL-001 source proof | Reproduced guard-level bug in Node v22.16 |
| JS fix and regression | Source patch prepared; final CI required |
| Native physics / browser parity | NOT_VERIFIED on new SHA |
| Local supported Node 24 / Python 3.12–3.14 | BLOCKED (no clone/download/network in container) |
| Independent Gemini Carbon High challenge | BLOCKED (not available) |
| Hosted browser performance / security headers | NOT_VERIFIED |
| Historical release / package publication | No change authorized or performed |
| Merge / deploy | NOT AUTHORIZED; no action taken |

No production claim, technical certification, test-pass count, or measured speedup is inferred. Reversal: revert the single scoped code/test commit after review, preserving historical records. If checks fail, retain draft PR and repair in branch before reconsidering release.

**Actions to complete:** evaluate final PR SHA against mandatory tests, record links and totals; independently review source contract/parity; only then consider PR readiness under normal repository policy.
