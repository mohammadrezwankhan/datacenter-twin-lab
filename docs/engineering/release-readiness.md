# Release readiness and independent reproduction

Version **0.4.0rc1** is a versioned candidate for the teaching and research workflow. Its supported boundary is a deterministic synthetic electrical-continuity calculation. A stable software label would not establish facility calibration or operational reliability.

The current release keeps the candidate label while the public reproduction request remains unanswered. A passing CI job, maintainer calculation, automated browser journey or coding-agent audit is internal engineering evidence. None can fill in a reviewer's identity or endorsement.

## Evidence required for this candidate

| Check | Reproduction route |
| --- | --- |
| Three canonical outputs and independent ledger arithmetic | `python scripts/build_evidence.py --output outputs/evidence` |
| Evidence file integrity | `python scripts/build_evidence.py --verify outputs/evidence` |
| Numerical, API and CLI regression | `python -m unittest discover -s tests -v` |
| JavaScript/native equality and browser journeys | `npm --prefix apps/web run test:engine` and `npm --prefix apps/web run test:demo` after the documented build |
| Installed package outside the checkout | `python scripts/verify_distribution.py dist --require-web` |
| Windows/Linux and Python 3.12/3.14 execution | Commit-specific CI jobs and their numerical-evidence artifacts |
| Signed-out source, static deployment and optional Python cross-check | Dated publication receipt; live browser result and matching published asset hashes |

The release page names the actual revision, checksums and completed checks. Build configuration describes intended coverage; it is not a substitute for a successful run on the released revision.

## Stable-release decision

1. Receive an attributed review through the [existing review discussion](https://github.com/mohammadrezwankhan/datacenter-twin-lab/discussions/5), using the [protocol](../validation/review-protocol.md) and [receipt template](../validation/reviewer-receipt-template.md).
2. Resolve or explicitly document reproduced mismatches. Preserve the reviewer's own scope and consent to attribution.
3. Confirm the source/wheel/browser artifact hashes, reproduction commands, supported environments and migration notes for the selected stable revision.
4. Publish a new stable tag and release. Do not rename the candidate or replace historical release assets to imply earlier validation.

## Archive and reference-data decisions

The current citation metadata identifies the software version and owner. A DOI can be added after the stable artifact and its deposit metadata are approved and an authorized archive account is available. There is no DOI or archive endorsement to cite today.

Calibrated or publicly documented facility cases need data rights, a named validation responsibility, parameter uncertainty, measurement provenance and a separate acceptance boundary. No such dataset is included in this release. The synthetic cases remain useful for reproducible teaching without broadening the physical model.
