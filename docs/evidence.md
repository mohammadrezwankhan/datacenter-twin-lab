# Reproduction evidence

The `0.4.0rc1` candidate is a synthetic teaching model for one aggregate IT load. It covers utility/generator availability, finite battery energy, conversion losses, distribution-path limits, deterministic restoration, and interval energy accounting. It is not calibrated to a facility and does not model cooling transients, workload service, protection coordination, safety certification, or physical controls. See the [electrical-continuity boundary](engineering/electrical-continuity.md) and the [external-review protocol](validation/review-protocol.md).

## Canonical outcomes

The two ride-through cases follow browser lesson 3: starting from `demo_scenario("generator_failure")`, set the course ID/name, append and deduplicate `EDU-POWER-001`, disable charging, and use `100 kWh` or `50 kWh` initial battery energy. Each case requests `1,000 kW` for `1,800 s`, for `500 kWh` requested.

| Synthetic case | Independent equation | Expected result |
| --- | --- | --- |
| 1 MW, 100 kWh | `100 Ã— 0.90 Ã— 0.95 Ã· 1,000 Ã— 3,600` | `307.8 s` ride-through; depletion at `607.8 s` elapsed; `81.166666â€¦ kWh` unserved |
| 1 MW, 50 kWh | `50 Ã— 0.90 Ã— 0.95 Ã· 1,000 Ã— 3,600` | `153.9 s` ride-through; depletion at `453.9 s` elapsed; `123.916666â€¦ kWh` unserved |
| Path maintenance | `700 Ã— 0.95 = 665 kW`; `1,000 âˆ’ 665 = 335 kW`; `335 Ã— 600 Ã· 3,600` | `665 kW` served, `335 kW` unserved for `600 s`; `55.833333â€¦ kWh` unserved |

Ride-through is measured from the `300 s` outage boundary; depletion time is the elapsed event timestamp. The path case uses the existing [`path_maintenance` scenario](scenarios/path_maintenance.md). Inputs and event schedules are original synthetic assumptions. Their provenance is listed in [`data/provenance/manifest.json`](../data/provenance/manifest.json); the private manual and its extracted text are excluded. The project citation and license references are [`CITATION.cff`](../CITATION.cff), [`LICENSE`](../LICENSE), and [`NOTICE`](../NOTICE).

## Versioned packet and verification

The tracked [`0.4.0rc1 evidence index`](../data/evidence/index-v0.4.0rc1.json) links the cases to their input hashes, run IDs, scenario/run JSON, reports, [`manifest.json`](../data/evidence/v0.4.0rc1/manifest.json), and [receipt](../data/evidence/v0.4.0rc1/receipt.md). The manifest hashes every packet file except itself; its digest should be retained separately when pinning a copy.

From a clean checkout of the exact candidate source, build and verify a fresh local packet:

```sh
python scripts/build_evidence.py --output outputs/reproduction-0.4.0rc1 \
  --revision <public-commit-or-tag> \
  --repository mohammadrezwankhan/datacenter-twin-lab
python scripts/build_evidence.py --verify outputs/reproduction-0.4.0rc1
```

The operator supplies optional public revision/repository context explicitly; the script does not inspect Git remotes or include local paths. Verification first checks manifest-declared hashes and file set, then requires the supported packet schema, `0.4.0rc1` engine version, public-context shape, and exactly the three supported cases. It regenerates their scenarios, equations, interval ledgers, runs, reports, and receipt using only that explicit context, then compares deterministic numerical artifacts byte-for-byte. It rejects a self-consistently rehashed forged run or omitted case. `environment.json` is hash-checked and shape-checked; Python/OS values may describe another supported environment and are not independently attested.

Engine strings use a 100-significant-digit, round-half-even decimal context. The one-page receipt abbreviates values to 14 significant digits with an ellipsis; packet JSON retains full strings. Independent ledger checks sum the exported interval energy terms as exact fractions, without trusting reported residual fields. They compare with a maximum absolute tolerance of `1e-90` in the displayed unit. `--verify` provides current-engine reproduction and integrity checks, not authenticity or reviewer identity; a manifest digest must be pinned out of band to detect coordinated replacement of both files and manifest.

The existing [native benchmark method](../scripts/benchmark_continuity.py) and [candidate benchmark record](validation/native-benchmark-0.4.0rc1.json) document software timing separately from numerical correctness. The [benchmark method and observed browser payload](engineering/benchmark-method.md) explain timing scope, the supported-environment matrix and the focused accessibility audit. Candidate source is associated with the [v0.4.0rc1 release page](https://github.com/mohammadrezwankhan/datacenter-twin-lab/releases/tag/v0.4.0rc1); workflow configuration/results are available at [the public tests workflow](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/workflows/tests.yml). Workflow configuration is not evidence that a particular candidate revision passed; consult its commit-specific run.

No independent external technical review has been obtained. Maintainer equations, tests, packet verification, browser QA, CI, and benchmark records are maintainer evidence; they do not substitute for the independent execution and reporting required by the [review protocol](validation/review-protocol.md). The blank [reviewer receipt template](validation/reviewer-receipt-template.md) is not an endorsement. This is a release candidate, not a stable-release or facility-validation claim.
