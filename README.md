# Datacenter Twin Lab

**A reproducible, local-first power-continuity what-if simulator for data-center engineers, researchers, Python developers, and educators.**

[**Open the zero-install demo →**](https://mohammadrezwankhan.github.io/datacenter-twin-lab/) · [Scenario catalog](docs/scenarios/index.md) · [Quickstart](docs/quickstart.md) · [Discuss a result](https://github.com/mohammadrezwankhan/datacenter-twin-lab/discussions)

Alpha 0.3.0a0 · Python 3.12+ · Apache-2.0

[![Tests](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/workflows/tests.yml/badge.svg)](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/workflows/tests.yml)

## A generator fails. How long does the battery last?

Start with a synthetic 1 MW load and 100 kWh battery. Utility and generator fail at 300 seconds. The battery supplies IT for **307.8 seconds**, depletes at **607.8 seconds elapsed**, and utility restores service at **900 seconds**. The run accounts for **81.1667 kWh of unserved IT energy** with zero energy-balance residual.

In the [browser demo](https://mohammadrezwankhan.github.io/datacenter-twin-lab/), change initial battery energy to 50 kWh, run again, jump to depletion and recovery, then export JSON or a report. The same Python engine runs on your device through WebAssembly. No installation, account, or simulation server is required; the first load downloads about 14 MB. [How it works and privacy](docs/engineering/browser-demo.md).

These are reproducible synthetic calculations. The model is uncalibrated and does not predict cooling, GPU/workload performance, AC transients, protection coordination, certified uptime, or facility safety. It has no live equipment controls.

![Actual local dashboard showing the synthetic electrical model](docs/images/overview.png)

## Reproduce the result in Python

The core uses only the standard library. With Python 3.12+:

```sh
git clone https://github.com/mohammadrezwankhan/datacenter-twin-lab.git
cd datacenter-twin-lab
python -m datacenter_twin simulate --preset generator_failure
python -m datacenter_twin simulate --preset generator_failure --format html --output outputs/failure.html
python -m datacenter_twin sweep --preset generator_failure --parameter battery_initial_kwh --values 0 50 100 --format markdown
```

Outputs preserve assumptions, units, stable input hashes, warnings, and exact energy ledgers. Unknown costs remain unknown. Existing output files are protected; choose a new path or explicitly use `--force`. The [sensitivity guide](docs/engineering/sensitivity.md) explains the parameters and pre-outage charging. [Example report and reproducibility capsule](docs/validation/reproducibility-capsule.md) include independent equations and artifact hashes.

## Choose a question

| Question | Preset | Expected result |
| --- | --- | --- |
| What happens with healthy supply? | [normal](docs/scenarios/normal.md) | 500 kWh served over 30 minutes |
| Can the battery bridge generator startup? | [utility_loss](docs/scenarios/utility_loss.md) | 30-second startup bridged; no unserved load |
| What if the generator also fails? | [generator_failure](docs/scenarios/generator_failure.md) | Battery depletion at 607.8 s; recovery at 900 s |
| Can one surviving path carry the load? | [path_maintenance](docs/scenarios/path_maintenance.md) | 700 kW gross × 0.95 = 665 kW IT; 335 kW unserved |
| What if both paths share a failed control domain? | [shared_domain](docs/scenarios/shared_domain.md) | Both paths unavailable for 600 s |

The [worked tutorial](docs/tutorials/continuity-walkthrough.md) develops the battery and surviving-path calculations. Schema-1 PUE/energy planning remains a separate calculation from schema-2 continuity; see the [contracts](docs/contracts/electrical-v2.md).

## Use the local dashboard

The [Python-only released-wheel quickstart](docs/quickstart.md#run-the-released-dashboard-python-only) installs the 0.3.0a0 dashboard, including reports and sensitivity controls, without Node.

To build this version locally, install Node 24 and use an isolated Python environment:

```sh
python -m venv .venv
```

Activate it (`.venv\Scripts\Activate.ps1` in PowerShell; `source .venv/bin/activate` on POSIX), then:

```sh
python -m pip install -r requirements-api.lock
npm --prefix apps/web ci --ignore-scripts
npm --prefix apps/web run build
python -m datacenter_twin serve
```

Open `http://127.0.0.1:8000`. Installation downloads dependencies; calculations use the local engine. The API remains bound to loopback. See the [security boundary](SECURITY.md).

## Validate or contribute

```sh
python -m unittest discover -s tests -v
```

CI checks Python 3.12 and 3.14 on Windows and Linux, the installed wheel, local dashboard journeys, and browser/native equality. These checks establish software behavior for the fixtures. **Independent external technical review has not yet been obtained.** The [review protocol](docs/validation/review-protocol.md) provides a bounded worksheet for checking results and reporting mismatches.

Start with [contribution guidance](CONTRIBUTING.md), [beginner contribution ideas](docs/scenarios/contribution-ideas.md), the [roadmap](ROADMAP.md), or [support](SUPPORT.md). Reproducible questions and hand-calculated edge cases are useful contributions. Participants follow the [Code of Conduct](CODE_OF_CONDUCT.md).

Original code and synthetic fixtures use [Apache-2.0](LICENSE); see [NOTICE](NOTICE), [synthetic provenance](data/provenance/manifest.json), and [browser runtime licenses](docs/third-party/README.md). [SOURCE-MANIFEST.json](SOURCE-MANIFEST.json) identifies the original v0.2.0a0 snapshot, not subsequent versions. [Citation metadata](CITATION.cff) accompanies the project; cite the exact release or commit used.
