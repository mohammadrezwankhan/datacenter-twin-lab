# Datacenter Twin Lab

**How long can a 5 MWh battery keep a 50 MW aggregate AI-cluster load supplied when utility and generator power fail?**

The browser demo's synthetic AI-cluster case requests **50,000 kW (50 MW)** and starts with **5,000 kWh (5 MWh)** of stored battery energy. When utility and generator supply fail at 300 s, the battery supplies IT for **307.8 s** and depletes at **607.8 s elapsed**. That gives a datacenter engineer a concrete continuity question to run, inspect, and reproduce.

[**Open the browser demo and run the AI-cluster scenario →**](https://mohammadrezwankhan.github.io/datacenter-twin-lab/) · [Start the 12-lesson course](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=power-energy) · [Course notes](docs/tutorials/power-systems-course.md)

After the result appears, continue with the [tutorials](docs/tutorials/index.md), [scenario catalog](docs/scenarios/index.md), or [quickstart](docs/quickstart.md). Use [Discussions](https://github.com/mohammadrezwankhan/datacenter-twin-lab/discussions) to share a reproducible result.

## Try the result now

1. Open the [zero-install browser demo](https://mohammadrezwankhan.github.io/datacenter-twin-lab/).
2. Run **AI-cluster generator failure** with the default synthetic fixture.
3. Select the **Battery depleted 607.8 s** event. Served IT power is **0 kW** until utility restoration at **900 s**.

The AI-cluster values are a 50× scale-up of the verified 1 MW / 100 kWh teaching fixture. The ratios preserve the same modeled 0.90 discharge efficiency and 0.95 distribution efficiency, so the ride-through duration and event times stay the same.

The default browser journey calculates locally with exact JavaScript arithmetic. Use **Verify against Python** for an optional Pyodide cross-check; the Python runtime is loaded on demand for that check rather than for the initial result.

No installation or account is needed for the browser result. See [calculation and privacy](docs/engineering/browser-demo.md) for the browser boundary and the [teaching notebook](docs/examples/battery-ride-through.ipynb) for an independently calculated reference case.

## A short 1 MW experiment

The original `generator_failure` preset remains available for the small fixture. Open it with [`?preset=generator_failure`](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?preset=generator_failure), change **Initial battery** from **100** to **50 kWh**, run the scenario, and inspect the battery-depleted event. Pre-outage charging explains why the charging-enabled 50 kWh case lasts until **478.2675 s**. Export a report or compare reserves after the run.

The [1 MW recorded walkthrough](docs/examples/demo-walkthrough.md) preserves an earlier interface capture, with a text transcript and reproduction recipe. The live demo above contains the current controls.

## Choose a question

| Question | Preset | Expected result |
| --- | --- | --- |
| What happens with a 50 MW aggregate AI-cluster load? | [ai_cluster_generator_failure](docs/scenarios/ai-cluster-50mw.md) | Battery supplies IT for 307.8 s; depletion at 607.8 s; utility restoration at 900 s |
| What happens with healthy 1 MW supply? | [normal](docs/scenarios/normal.md) | 500 kWh served over 30 minutes |
| Can the 1 MW battery bridge generator startup? | [utility_loss](docs/scenarios/utility_loss.md) | 30-second startup bridged; no unserved load |
| What if the 1 MW generator also fails? | [generator_failure](docs/scenarios/generator_failure.md) | Battery depletion at 607.8 s; recovery at 900 s |
| Can one surviving path carry the 1 MW load? | [path_maintenance](docs/scenarios/path_maintenance.md) | 700 kW gross × 0.95 = 665 kW IT; 335 kW unserved |
| What if both paths share a failed control domain? | [shared_domain](docs/scenarios/shared_domain.md) | Both paths unavailable for 600 s |

The [worked tutorial](docs/tutorials/continuity-walkthrough.md) develops the surviving-path and finite-battery calculations. The [AI-cluster scenario note](docs/scenarios/ai-cluster-50mw.md) documents the scaled case. Schema-1 PUE/energy planning is a separate calculation from schema-2 continuity; see the [electrical contract](docs/contracts/electrical-v2.md).

## Reproduce the 1 MW result in Python

The core uses only the standard library. [Run the released CLI or dashboard with one uv command](docs/quickstart.md#run-with-uv), or use Python 3.12+ and a source checkout. These commands intentionally reproduce the original **1,000 kW / 100 kWh** fixture:

```sh
git clone https://github.com/mohammadrezwankhan/datacenter-twin-lab.git
cd datacenter-twin-lab
python -m datacenter_twin simulate --preset generator_failure
python -m datacenter_twin simulate --preset generator_failure --format html --output outputs/failure.html
python -m datacenter_twin sweep --preset generator_failure --parameter battery_initial_kwh --values 0 50 100 --format markdown
```

Outputs preserve assumptions, units, stable input hashes, warnings, and exact energy ledgers. Unknown costs remain unknown. Existing output files are protected; choose a new path or explicitly use `--force`. The [sensitivity guide](docs/engineering/sensitivity.md) explains the parameters and pre-outage charging. The [example report and reproducibility capsule](docs/validation/reproducibility-capsule.md) include independent equations and artifact hashes.

## Use the local dashboard

The [released-wheel quickstart](docs/quickstart.md#run-the-released-dashboard-python-only) installs the dashboard with Python and pip. The [uv route](docs/quickstart.md#run-with-uv) creates its isolated environment automatically. Both include reports and sensitivity controls without Node.

For development, follow the [locked source build](docs/quickstart.md#local-dashboard). Open `http://127.0.0.1:8000` after starting the server. Calculations use the local engine and the API binds to loopback. See the [security boundary](SECURITY.md).

## Validate or contribute

```sh
python -m unittest discover -s tests -v
```

CI checks Python 3.12 and 3.14 on Windows and Linux, the installed wheel, local dashboard journeys, and browser/native equality. These checks establish software behavior for the fixtures. **Independent external technical review has not yet been obtained.** The [review protocol](docs/validation/review-protocol.md) provides a bounded worksheet for checking results and reporting mismatches.

Start with [contribution guidance](CONTRIBUTING.md), [beginner contribution ideas](docs/scenarios/contribution-ideas.md), the [roadmap](ROADMAP.md), or [support](SUPPORT.md). Participants follow the [Code of Conduct](CODE_OF_CONDUCT.md).

For a task-based comparison with OpenDC and PyPSA, see [Choosing a simulator](docs/choosing-a-simulator.md).

## Assumptions and limits

This is a deterministic, local-first teaching simulator for a single aggregate IT load. The 50 MW example does not predict GPU throughput, grid adequacy, equipment selection or measured site behavior. The current model covers synthetic utility, generator, finite stored energy, conversion losses, path limits, shared-domain events, deterministic recovery, replay, and exact energy accounting. It does not establish facility calibration, protection coordination, AC transients, cooling behavior, workload queues or throughput, generator ramp/cooldown/fuel dynamics, transfer and switching transients, impedance-based load sharing, harmonics, short-circuit or arc-flash studies, reliability probabilities, Tier claims, service-level claims, certification, physical controls, or physical safety.

| You can use it to | Model boundary |
| --- | --- |
| Compare synthetic utility, generator, battery, and path failures | Assumed equipment ratings and efficiencies; no facility calibration |
| Reproduce event times, energy ledgers, and sensitivity reports | Electrical continuity only; no AC transients, protection, cooling, or workload prediction |
| Learn, inspect, and share a calculation locally | No physical controls, certified uptime, or facility safety assessment |

The original fixture uses a 1,000 kW IT request, 1,800 s duration, 0.95 distribution efficiency, 100 kWh initial and maximum battery energy, 0.90 discharge efficiency, a 30 s generator start delay, 700 kW path capacities, and a fictional USD 0.10/kWh tariff. The AI-cluster fixture scales demand and battery energy to 50,000 kW and 5,000 kWh while preserving those ratios. These are synthetic inputs. They are not selected-equipment ratings, live prices, a benchmark, a certification, a legal-compliance result, or a real-site calibration.

Schema-1 PUE and energy planning remains separate from schema-2 electrical topology. Neither model silently infers the other. Unknown costs and unavailable quantities stay explicit in reports. The catalogue's dated NVIDIA/model/AWS/Azure/OCI identifiers and one dated Azure East US retail meter are source-backed assumptions, not live feeds, account quotes, capacity allocations, or performance equivalence. Germany, Virginia, and India links are screening pointers, not complete jurisdiction packs or legal advice; India screening must consider the CEA's listed 2026 amendment.

The browser demo has no shared simulation backend or client analytics. The API binds to loopback. No account, GPU, cloud resource, physical control, shared deployment, database, login, tenant isolation, persistent audit, FAT/SAT, or facility telemetry is introduced. Cooling, workload throughput, calibrated alarms, live telemetry, and predictive models remain planned or unvalidated. A 5,000-star aspiration has no validated timeline and is not evidence of model accuracy or adoption.

Local and CI checks cover the core/API suite, frontend format/type/build, installed-wheel verification, local dashboard journeys, browser/Python journeys, and browser/native equality for the synthetic presets. Reference-case timing measures software execution on one local machine; it does not establish scale targets or physical accuracy. These checks are not an independent external review or formal security audit. No facility measurements or validation dataset were used.

The public source tree excludes private manuals, planning references and the private repository history. Do not add private manuals, extracted private text, credentials, customer traces, or licensed standards text.

Original code and synthetic fixtures use [Apache-2.0](LICENSE). See [NOTICE](NOTICE), [synthetic provenance](data/provenance/manifest.json), and [browser runtime licenses](docs/third-party/README.md). [SOURCE-MANIFEST.json](SOURCE-MANIFEST.json) identifies the original v0.2.0a0 snapshot, not subsequent versions. [Citation metadata](CITATION.cff) accompanies the project; cite the exact release or commit used.

[Optional full-size visual concept](docs/images/datacenter-twin-lab-cover-v1.png) (a large artwork asset; it is not part of the initial demo path).

Alpha 0.3.0a0 · Python 3.12+ · Apache-2.0

[![Tests](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/workflows/tests.yml/badge.svg)](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/workflows/tests.yml)
