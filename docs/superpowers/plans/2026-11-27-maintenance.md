# November maintenance implementation plan

**Goal:** Audit and update the current public project, qualify compatible dependency upgrades, repair bounded-input validation, and publish a verified maintenance release.

**Architecture:** Preserve the deterministic simulation contracts and current public source. Update existing dependency manifests and locks together; keep the existing CI job names, supported environments, numerical tolerances, security controls and deployment guards.

**Tech stack:** Python 3.12/3.14, React, TypeScript, Vite, Pyodide, unittest, Playwright and immutable GitHub Actions.

## Constraints and review focus

- No fabricated benchmark, external-review, calibration or adoption claims.
- No paid service or billing change. Release publication follows current successful validation.
- Independently qualify native and browser scientific runtimes; keep current parity tolerances.
- Keep compatible TypeScript toolchain constraints and requalify security dependency overrides.
- Guard numeric conversion against arbitrarily large JSON integers without changing bounded simulation results.
- Preserve historical releases and source evidence; create a new version rather than replacing old tags or assets.

## Tasks

1. Record current repository, dependency and CI baselines. Run lock-only validation before downloads and the existing Python suite.
2. Update compatible direct dependencies, corresponding complete locks, upstream security-tool pins and immutable action hashes. Validate manifests against installed dependencies, package audit, lint, types, frontend build and browser tests. Record any custom scanner versions that require a separate source qualification rather than a pin substitution.
3. Reproduce oversized numeric input conversion with a regression test, implement bounded validation, and run the full Python tests and affected CLI journeys.
4. Align maintained package, engine and citation versions for the new maintenance release; update changelog and current dependency documentation while keeping historical evidence intact.
5. Perform a fresh review, submit the exact validated commit for existing CI, merge with a merge commit only after applicable checks pass, then publish and verify the resulting tag/release and available deployment receipt.

## Verification

Use the repository's existing Python regression, API contract, numerical study, JavaScript engine/parity, browser, package distribution and hardened security/quality gates. Distinguish local results, GitHub checks, hosted deployment and scientific validation in the final receipt.
