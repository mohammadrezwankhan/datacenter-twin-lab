# Reproducibility capsule: schema-2 continuity reports

This capsule records executable maintainer evidence for the public synthetic
continuity slice. It is a local, deterministic calculation record. It does not
claim facility calibration, external validation, hosted availability, or
physical equipment behavior.

## Re-run from source

From the repository root, use Python 3.12 or newer. Maintainer numerical
verification used Python 3.12.14 on Windows.

```sh
python -m unittest discover -s tests -v
python -m datacenter_twin simulate --preset generator_failure --format markdown \
  --output docs/validation/examples/generator-failure-report.md --force
python -m datacenter_twin simulate --preset generator_failure --format html \
  --output docs/validation/examples/generator-failure-report.html --force
python -m datacenter_twin sweep --preset generator_failure \
  --parameter battery_initial_kwh --values 0 50 100 --format markdown
```

The report commands regenerate small human-readable artifacts. They do not
commit a full interval JSON run to this capsule. The CLI's JSON mode remains
available for machine use, with its compatibility timestamp wrapper; the
Markdown and HTML modes contain no wall-clock timestamp and are byte-stable
for equal inputs.

## Maintainer evidence recorded here

The checked-in examples use the `generator_failure` preset from
`datacenter_twin.demo.demo_scenario`, whose synthetic topology is bundled in
`datacenter_twin/resources/reference-site-v2.json`.

| Artifact | Engine | Run ID | Input SHA-256 | Artifact SHA-256 | Bytes |
| --- | --- | --- | --- | --- | ---: |
| [Markdown report](examples/generator-failure-report.md) | `0.3.0a0` | `b93b91d64b3fc0bbd96b` | `202d1950bc8762c95216904dd9bbc890c1e1cdb51fe3f824e6e3d98f76410195` | `70159bdd25f39a5cd1c703ed273ef5e3de49c613e345454e188081cf80bc6e2b` | 2595 |
| [HTML report](examples/generator-failure-report.html) | `0.3.0a0` | `b93b91d64b3fc0bbd96b` | `202d1950bc8762c95216904dd9bbc890c1e1cdb51fe3f824e6e3d98f76410195` | `77039c122d9d182ed3916c50c1842bbb4c8f79a23422f95f9ca9fa26aed61c3e` | 4223 |

Verify an artifact digest with a platform-appropriate command, for example:

```sh
python -c "from pathlib import Path; import hashlib; p=Path('docs/validation/examples/generator-failure-report.md'); print(hashlib.sha256(p.read_bytes()).hexdigest())"
```

The report's input hash is the canonical schema-2 scenario hash. The report
also records the engine version, assumptions, units, warnings, event timeline,
energy balance residual, cost status, and model limitations. The hash is not a
claim that the synthetic scenario came from a measured site.

## Independent battery calculation

For an outage from `t=300 s` through `t=900 s`, the independent check below
uses a copy of the generator-failure scenario with `battery_charge_kw = 0` so
the sweep values remain opening stored-energy balances. It keeps the model's
`distribution_efficiency = 0.95`, `battery_discharge_efficiency = 0.90`, and
`it_demand_kw = 1000 kW`.

| Initial battery | Delivered IT energy | Ride-through at 1000 kW | Depletion time | Requested outage energy | Unserved outage energy |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 kWh | 0 kWh | 0 s | none; already empty at `t=300 s` | 166.666666666666... kWh | 166.666666666666... kWh |
| 50 kWh | `50 × 0.90 × 0.95 = 42.75` kWh | `42.75 / 1000 × 3600 = 153.9` s | `300 + 153.9 = 453.9 s` | 166.666666666666... kWh | 123.916666666666... kWh |
| 100 kWh | `100 × 0.90 × 0.95 = 85.5` kWh | `85.5 / 1000 × 3600 = 307.8` s | `300 + 307.8 = 607.8 s` | 166.666666666666... kWh | 81.166666666666... kWh |

At zero opening energy, the current event semantics emit `BATTERY_EMPTY`
warnings during the outage but do not emit a `battery_depleted` transition,
because no positive stored balance crosses to zero. That distinction is
preserved in the sweep summary's nullable `first_battery_depletion_s` field.
The exact engine ledger remains the executable source of truth for decimal
rounding and interval boundaries.

## Scope and review boundary

The browser bridge is JSON-only and dispatches the existing pure engine inside
a worker-compatible boundary. The bridge and loopback API tests compare all
five presets, reject duplicate or oversized input, exercise report and sweep
contracts, verify deterministic hashes, and check HTML escaping. They do not
establish browser-worker startup in every browser, physical electrical
behavior, cooling behavior, workload prediction, or a shared deployment.

No hosted URL should be treated as live evidence until the release maintainer
verifies that deployment separately. No external validation has been performed
for this synthetic slice.
