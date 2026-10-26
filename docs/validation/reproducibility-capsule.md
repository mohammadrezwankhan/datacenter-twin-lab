# Reproducibility capsule: schema-2 continuity reports

This capsule records executable maintainer evidence for the public synthetic
continuity slice. It is a local, deterministic calculation record. It does not
claim facility calibration, external validation, hosted availability, or
physical equipment behavior.

## Generate reports from the current source

From the repository root, use Python 3.12 or newer. Maintainer numerical
verification used Python 3.12.14 on Windows.

```sh
python -m unittest discover -s tests -v
python -m datacenter_twin simulate --preset generator_failure --format markdown --output outputs/capsule-current/generator-failure-report.md
python -m datacenter_twin simulate --preset generator_failure --format html --output outputs/capsule-current/generator-failure-report.html
python -m datacenter_twin sweep --preset generator_failure --parameter battery_initial_kwh --values 0 50 100 --format markdown
```

Choose unused output paths; these commands deliberately omit `--force` and do
not replace the checked-in evidence. Each report identifies the engine version,
input hash and run ID. The recorded reports below use engine `0.3.0a0`, so a
current engine's report need not match their bytes or run ID even when the input
hash and numerical results agree. Equal inputs and the same engine revision
produce byte-stable Markdown/HTML; JSON mode adds a compatibility timestamp
wrapper. The sweep above retains the preset's charging behavior; the independent
battery worksheet below explicitly disables charging instead.

## Maintainer evidence recorded here

The checked-in examples use the `generator_failure` preset from
`datacenter_twin.demo.demo_scenario`, whose synthetic topology is bundled in
`datacenter_twin/resources/reference-site-v2.json`.

| Artifact | Engine | Run ID | Input SHA-256 | Artifact SHA-256 | Bytes |
| --- | --- | --- | --- | --- | ---: |
| [Annotated Markdown report](examples/generator-failure-report.md) | `0.3.0a0` | `b93b91d64b3fc0bbd96b` | `202d1950bc8762c95216904dd9bbc890c1e1cdb51fe3f824e6e3d98f76410195` | `6024c11e7e44719b7a57b94d9ecb128122dbe34ab84179a6e75fba1dc70a0072` | 2768 |
| [HTML report](examples/generator-failure-report.html) | `0.3.0a0` | `b93b91d64b3fc0bbd96b` | `202d1950bc8762c95216904dd9bbc890c1e1cdb51fe3f824e6e3d98f76410195` | `77039c122d9d182ed3916c50c1842bbb4c8f79a23422f95f9ca9fa26aed61c3e` | 4223 |

The Markdown file includes two later illustration links; it is an annotated
copy, not the original raw engine export. The table hashes the actual linked
files. Verify their bytes from this checkout, for example:

```sh
python -c "from pathlib import Path; import hashlib; p=Path('docs/validation/examples/generator-failure-report.md'); print(hashlib.sha256(p.read_bytes()).hexdigest())"
```

### Reproduce the original export bytes

The public `v0.3.0a0` tag points to
[`96fcf002f69ef53b2298330b9ad96ae89807e491`](https://github.com/mohammadrezwankhan/datacenter-twin-lab/commit/96fcf002f69ef53b2298330b9ad96ae89807e491).
Use that exact revision in a separate, new worktree with Python 3.12 or newer:

The sibling worktree path must not already exist. For another reproduction,
choose a fresh worktree path and update both the `git worktree add` and `cd`
paths, or reuse the pinned worktree with unused report output paths.

```sh
git worktree add --detach ../datacenter-twin-capsule-v0.3.0a0 96fcf002f69ef53b2298330b9ad96ae89807e491
cd ../datacenter-twin-capsule-v0.3.0a0
python -m datacenter_twin simulate --preset generator_failure --format markdown --output outputs/capsule-v030/generator-failure-report.md
python -m datacenter_twin simulate --preset generator_failure --format html --output outputs/capsule-v030/generator-failure-report.html
python -c "from pathlib import Path; import hashlib; p=Path('outputs/capsule-v030/generator-failure-report.md'); print(hashlib.sha256(p.read_bytes()).hexdigest())"
python -c "from pathlib import Path; import hashlib; p=Path('outputs/capsule-v030/generator-failure-report.html'); print(hashlib.sha256(p.read_bytes()).hexdigest())"
```

The original generated Markdown is 2,595 bytes with SHA-256
`70159bdd25f39a5cd1c703ed273ef5e3de49c613e345454e188081cf80bc6e2b`;
HTML is 4,223 bytes with SHA-256
`77039c122d9d182ed3916c50c1842bbb4c8f79a23422f95f9ca9fa26aed61c3e`.
Both match the raw report files at that pinned revision. The annotated Markdown
in the current checkout intentionally has different bytes. A matching digest
establishes file identity, not independent review or physical accuracy.

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
seven presets, reject duplicate or oversized input, exercise report and sweep
contracts, verify deterministic hashes, and check HTML escaping. They do not
establish browser-worker startup in every browser, physical electrical
behavior, cooling behavior, workload prediction, or a shared deployment.

No hosted URL should be treated as live evidence until the release maintainer
verifies that deployment separately. No external validation has been performed
for this synthetic slice.
