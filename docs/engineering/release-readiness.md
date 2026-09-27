# Release scope and reproducibility

Version **1.0.0** is the first full release of the local teaching and research application. It includes the canonical 1 MW guide, twelve interactive lessons, eighteen presets, scenario import, demand-timeline editing, sensitivity tools, reports and printable worksheets. The owner selected this software milestone on 27 September 2026, superseding the earlier candidate-only publication decision.

The release decision does not assert independent external reproduction. That evidence remains outstanding through the [existing review discussion](https://github.com/mohammadrezwankhan/datacenter-twin-lab/discussions/5). A CI job, maintainer calculation, automated browser journey or coding-agent audit is internal engineering evidence, not a reviewer identity or endorsement. The application remains an uncalibrated synthetic electrical-continuity model.

## Required release checks

| Check | Reproduction route |
| --- | --- |
| Three canonical outputs and separate ledger arithmetic | `python scripts/build_evidence.py --output outputs/evidence` |
| Evidence integrity and recalculation | `python scripts/build_evidence.py --verify outputs/evidence` |
| Numerical, API and CLI regression | `python -m unittest discover -s tests -v` |
| JavaScript/native equality and browser journeys | `npm --prefix apps/web run test:engine` and `npm --prefix apps/web run test:demo` after the documented build |
| Installed package outside the checkout | `python scripts/verify_distribution.py dist --require-web` |
| Windows/Linux and Python 3.12/3.14 | Successful commit-specific CI jobs and their evidence artifacts |
| Static hosting | Tested browser artifact, anonymous file hashes and live JavaScript/Python equality |

The release page identifies the exact revision and completed checks. Configuration is not proof of a passing run. Keep source, wheel, browser and evidence checksums together; preserve earlier tags and assets.

## Compatibility and support

Version 1.0.0 preserves the 0.4.0rc3 numerical algorithms, eighteen preset inputs, CLI commands, schema-1 planning and schema-2 electrical contracts. Engine version and deterministic run identifiers change. Scenario input hashes and numerical results should remain identical for unchanged inputs. Reopening an older electrical export validates its inputs and calculates a new result; preserve the original export when comparing versions.

The supported product is a local CLI/API/dashboard and a static browser application. No cloud simulation backend, operational controller, facility calibration, uptime certification, GPU-job prediction or shared-service security guarantee is introduced. Bug reports should include the software version, inputs and reproducible observed behavior. Future incompatible public-contract changes require migration notes and a major version; maintenance fixes retain their documented numerical scope.

## External evidence, archive and reference data

External reviewers can use the [protocol](../validation/review-protocol.md) and [blank receipt](../validation/reviewer-receipt-template.md). Record actual attributed observations and resolve reproduced mismatches; never treat software release status as independent review.

A DOI requires an actual archive deposit with approved metadata and authorized access. No DOI is assigned. Calibrated facility cases require data rights, measurement provenance, uncertainty, a named validation responsibility and separate acceptance criteria. None is included. These evidence requirements remain open after v1.0.0.
