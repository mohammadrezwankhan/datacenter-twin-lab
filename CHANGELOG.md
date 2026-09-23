# Changelog

## 0.4.0rc1 — a result you can reproduce

This release candidate brings the current browser experience and its proof material into one versioned artifact. It is a candidate for external reproduction, not a claim of independent review or facility reliability.

- Start with a guided 1 MW experiment: predict ride-through, run the charging-disabled 100/50 kWh cases, and explain depletion with an equation and event states.
- Keep the full facility simulator in advanced mode and the twelve themed lessons in the course.
- Inspect three canonical outputs, independently reconstructed energy ledgers, content hashes and a reviewer worksheet in one evidence packet.
- Compare reserve, generator delay and distribution capacity while preserving the completed run and its assumptions.
- Use a captioned demonstration, keyboard navigation, explicit source-control names and automated accessibility checks.
- Reproduce environment-specific engine timing and browser entry measurements using the included tools. Timings are observations, not equipment response claims.

The numerical continuity and planning algorithms are unchanged. The guided inputs disable charging, as lesson 3 already does; the original `generator_failure` preset continues to allow charging. Versioned output identifiers change with the software version. Earlier alpha tags and release assets remain available as historical artifacts.

See [research evidence](docs/evidence.md), [the canonical case](docs/canonical-case.md), and [release readiness](docs/engineering/release-readiness.md) for the scope and reproduction route.

## 0.3.0a0 — browser Python and reproducible reports

Published 9 September 2026. Added the static Python browser demo, bounded sensitivity sweeps, Markdown/HTML reports and a reproducibility capsule. Later source changes added the JavaScript first-result path, course and facility workspace; those later changes were not retroactively added to this tag.

## 0.2.0a0 — synthetic continuity alpha

Published 8 September 2026. Initial clean public companion with the deterministic continuity engine, synthetic scenarios, local API and dashboard.
