# External review protocol

This protocol is for a bounded review of software behavior and reproducibility. It is not a facility acceptance test, protection study, equipment validation, certification exercise, uptime claim, cooling/workload study, or physical-control procedure.

## Review boundary

The reviewer receives a tagged source or wheel, the public scenario catalog, and the exact commands listed below. The review should use only the synthetic schema-2 presets unless a separately documented, sanitized scenario is agreed in advance. No private manual, customer telemetry, credential, licensed standards text, or sensitive facility detail is needed.

The reviewer may evaluate:

- schema validation, event ordering, source availability, path/domain dependency behavior, and replay;
- unit-labelled served/unserved power and energy results;
- battery depletion, generator delay, recovery, and zero energy-balance residuals;
- deterministic output, input hashes, run IDs, warnings, and explicit unknown costs; and
- whether documentation describes assumptions and exclusions accurately.

The reviewer must not infer real-site accuracy from synthetic agreement or interpret a passing software test as a safety or reliability claim.

## Maintainer evidence versus independent review

The repository’s tests, tutorials, CI records, package checks, scenario outputs, and hand calculations are **maintainer evidence**. They show what the project claims and how the current revision behaves.

An **independent external review** requires a reviewer who was not the author of the implementation to execute the pinned commands, reconstruct at least one result without relying on the implementation’s reported residual, record the revision and input hash, and report mismatches or agreement with reasoning. No independent external review has been obtained yet. A maintainer cannot relabel an internal rerun as external review.

## Reproduction steps

Use Python 3.12 or later from the repository root:

```sh
python -m datacenter_twin simulate --preset normal
python -m datacenter_twin simulate --preset utility_loss
python -m datacenter_twin simulate --preset generator_failure
python -m datacenter_twin simulate --preset path_maintenance
python -m datacenter_twin simulate --preset shared_domain
python -m unittest discover -s tests -v
```

For each run, record:

1. exact release tag or commit;
2. Python version, operating system, and source/wheel route;
3. command and preset;
4. input SHA-256 and stable run ID;
5. relevant event times, served/unserved power and energy, battery opening/closing energy, warnings, and units; and
6. `energy_balance_residual_kwh` plus an independent reconstruction from the exported ledger terms.

If the reviewer saves an output, remove local paths and any private data before sharing it. The default presets are already synthetic and contain no customer telemetry.

## Independent worksheet

| Case | Independent calculation to record | Expected result from current fixture |
| --- | --- | --- |
| `normal` | `1,000 kW × 1,800/3,600 h` | 500 kWh served; 0 kWh unserved; battery final 100 kWh |
| `utility_loss` | Generator ready at `300 s + 30 s = 330 s`; bridge is `1,000 kW × 30/3,600 h` | 500 kWh served; 0 s unserved; generator energy 166.666666... kWh |
| `generator_failure` | `100 kWh × 0.90 × 0.95 = 85.5 kWh`; `85.5/1,000 × 3,600 = 307.8 s`; depletion `300 + 307.8 = 607.8 s` | 292.2 s unserved; 81.166666... kWh unserved; final battery 23.75 kWh |
| `path_maintenance` | `700 kW × 0.95 = 665 kW`; `(1,000 − 665) × 600/3,600 h` | 665 kW served; 335 kW unserved; 55.833333... kWh unserved; battery final 100 kWh |
| `shared_domain` | `1,000 kW × 600/3,600 h` | 1,000 kW unserved for 600 s; 166.666666... kWh unserved; battery final 100 kWh |

The `generator_failure` `307.8 s` value is ride-through duration measured from the 300 s outage boundary. `607.8 s` is the absolute event timestamp. Do not report them as interchangeable.

## Reporting criteria

A review note should classify each observation as **reproduced**, **mismatch**, **documentation ambiguity**, or **out of scope**. For every mismatch, include the smallest sanitized reproduction, expected and observed values with units, the equation or independent reference, and whether the difference is rounding, environment, documentation, or implementation behavior. For every reproduced result, state what was independently calculated and what was only observed from the engine.

The final note should include:

- revision and environment;
- cases and commands executed;
- input hashes and output/run identifiers where available;
- worksheet calculations and any rounding convention;
- mismatches, corrections, unresolved questions, and limitations; and
- an explicit statement that the review does not validate a facility, equipment, workload, cooling system, certification, or physical control.

Publish only the sanitized scope and result that the reviewer is comfortable sharing. A review receipt should identify the reviewer’s role or affiliation only when they choose to disclose it; do not invent an affiliation or imply endorsement.
