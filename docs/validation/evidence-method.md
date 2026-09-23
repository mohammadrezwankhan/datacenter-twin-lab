# Evidence packet calculation method

The builder creates two exact course variants and the existing path-maintenance preset. Course cases are reconstructed from the public course recipe rather than by changing a finished run. Their scenario JSON is passed through `SiteScenario.from_dict`, then to `simulate_continuity`. Each scenario has a stable `input_sha256`; filenames for its scenario, run, and reports include that digest.

Independent expected values are derived from the validated scenario's decimal inputs as exact `Fraction` values. No run summary is used to calculate the expectation:

- Ride-through: `opening_kWh × battery_discharge_efficiency × distribution_efficiency ÷ IT_kW × 3,600`.
- Depletion timestamp: utility-outage start plus the ride-through duration.
- Unserved interval: utility-recovery timestamp minus depletion, bounded below by zero; unserved energy is `IT_kW × unserved_seconds ÷ 3,600`.
- Path maintenance: sum the capacities of distribution assets not named by the path-down event; multiply by distribution efficiency for delivered IT kW; subtract from requested IT kW; multiply the deficit by the outage duration and divide by `3,600` for unserved kWh.
- Requested IT energy: `IT_kW × duration_seconds ÷ 3,600`.

The whole-run ledger reconstructs values from each exported `intervals[*].energy` decimal string. It checks source energy against served energy, battery stored-energy change, and the three conversion-loss terms; checks requested against served plus unserved; and checks opening/closing battery values against summed stored-energy changes. It never reads `energy_balance_residual_kwh` to decide whether a ledger check passes. Decimal strings are converted to exact fractions for summation. Engine output uses a 100-significant-digit, round-half-even decimal context; comparisons allow an absolute `1e-90` difference in the displayed unit.

`manifest.json` hashes every packet file other than itself. The builder prints its own digest for an operator to retain separately. `verify` first checks the manifest-declared file set and recomputes every listed SHA-256; it then checks the supported schema, current engine version, public-context shape, environment-metadata shape, and exact three-case set. It regenerates the cases from only the explicitly recorded `revision` and `repository` context and compares all deterministic scenario, run, report, receipt, expectation, and ledger content. Rehashed forged runs, modified expected/observed claims, unsupported versions, and omitted numerical files therefore fail reproduction. The recorded Python/OS values in `environment.json` are allowed to differ from the verifier's host, but are only self-reported metadata and are not attested.

These checks establish current-engine numerical reproduction plus file integrity, not authenticity or reviewer identity. The packet does not include a signature. To detect coordinated replacement of both artifacts and manifest, compare the builder-printed manifest digest with a separately pinned value.

Numerical outputs do not contain generation timestamps, machine paths, or inferred repository metadata. `environment.json` separately records Python implementation/version and operating-system identifiers. Optional repository/revision fields are copied only from explicit CLI arguments; the verifier applies basic public-identifier/HTTPS and revision-string shape checks but does not contact the repository or prove the values match the checkout.

The registered independent-review status is `not_obtained`. All calculations, tests, and packet files produced by project authors remain maintainer evidence. See the [external review protocol](review-protocol.md) for the additional work required for an independent report and its limits.
