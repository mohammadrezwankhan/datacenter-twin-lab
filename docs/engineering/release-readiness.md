# Release scope and reproducibility

The published **[2.0.1 maintenance release](../releases/v2.0.1.md)** packages the later odd-record spectrum
correction, complete current-dashboard inventory checks and Windows first-run
guidance. See [the patch notes](../releases/v2.0.1.md) and [current evidence](../evidence.md).
Its 2026-10-26 publication receipt identifies the exact checked source, fresh installed artifacts and verified static delivery. The gates below continue to apply to future releases; a prepared source, tag or draft alone is not publication. Published v2.0.0 assets remain unchanged.

Version **2.0.0 — Infrastructure Engineering** extends the local teaching and research application to 24 lessons. It retains the canonical 1 MW guide, eighteen presets, four facility profiles, scenario import, demand-timeline editing, sensitivity tools, reports, printable legacy worksheets, EMT and five power-dynamics studies. Twelve infrastructure lessons add bounded educational screens, separate result serialization, original diagrams, 36 assessments and static reading notes. The [owner's publication decision](../releases/v2.0.0-publication-decision.md) covers attribution and educational publication while retaining engineering HOLD.

Version 1.0.0 remains the first full software release, selected on 27 September 2026. Its published assets and historical evidence predate the later EMT, power-dynamics and infrastructure additions and are unchanged.

The release decision does not assert independent external reproduction. That evidence remains outstanding through the [existing review discussion](https://github.com/mohammadrezwankhan/datacenter-twin-lab/discussions/5). A CI job, maintainer calculation, automated browser journey or coding-agent audit is internal engineering evidence, not a reviewer identity or endorsement. The application remains an uncalibrated synthetic electrical-continuity model.

## Required release checks

| Check | Reproduction route |
| --- | --- |
| Three canonical outputs and separate ledger arithmetic | `python scripts/build_evidence.py --output outputs/evidence` |
| Evidence integrity and recalculation | `python scripts/build_evidence.py --verify outputs/evidence` |
| Numerical, API and CLI regression | `python -m unittest discover -s tests -v` |
| JavaScript/native equality and browser journeys | `npm --prefix apps/web run test:engine` and `npm --prefix apps/web run test:demo` after the documented build |
| Infrastructure defaults, challenges and independent equations | `python scripts/verify_infrastructure.py` and the typed infrastructure tests |
| Installed package outside the checkout | `python scripts/verify_distribution.py dist --require-web` |
| Windows/Linux and Python 3.12/3.14 | Successful commit-specific CI jobs and their evidence artifacts |
| Static hosting | Tested browser artifact, anonymous file hashes and live JavaScript/Python equality |

The release page identifies the exact revision and completed checks. Configuration is not proof of a passing run. Keep source, wheel, browser and evidence checksums together; preserve earlier tags and assets.

For a wheel containing the dashboard, retain the current native build in `datacenter_twin/web` when running the distribution verifier. It compares the complete web file inventory and SHA-256 bytes, including files outside the evidence manifest. Build the wheel in a fresh packaging source/build tree: an old setuptools `build/lib` can retain obsolete evidence or hashed assets even after a new dashboard build. A fresh installation environment alone does not establish wheel freshness. Core-only wheels remain valid without `--require-web`, including when a local dashboard build exists; the flag requires the dashboard.

## Compatibility and support

Version 2.0.0 preserves the existing numerical algorithms, eighteen preset inputs, CLI commands, schema-1 planning and schema-2 electrical contracts. Infrastructure screens use the separate `infrastructure-screen-1` family and do not inherit the legacy Python-verification badge. Engine version and deterministic run identifiers change; scenario input hashes and numerical results remain identical for unchanged inputs. Reopening an older electrical export validates its inputs and calculates a new result; preserve the original export when comparing versions. The owner's product version does not authorize breaking the existing schemas.

The supported product is a local CLI/API/dashboard and a static browser application. No cloud simulation backend, operational controller, facility calibration, uptime certification, GPU-job prediction or shared-service security guarantee is introduced. Bug reports should include the software version, inputs and reproducible observed behavior. Future incompatible public-contract changes require migration notes and a major version; maintenance fixes retain their documented numerical scope.

## External evidence, archive and reference data

External reviewers can use the [protocol](../validation/review-protocol.md) and [blank receipt](../validation/reviewer-receipt-template.md). Record actual attributed observations and resolve reproduced mismatches; never treat software release status as independent review.

A DOI requires an actual archive deposit with approved metadata and authorized access. No DOI is assigned. Calibrated facility cases require data rights, measurement provenance, uncertainty, a named validation responsibility and separate acceptance criteria. None is included. These evidence requirements remain open after v2.0.0.
