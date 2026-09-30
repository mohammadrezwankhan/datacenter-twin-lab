# Datacenter Twin

Reproduce a datacenter power outage, inspect the energy ledger, and export a report.

**[Try the browser course](https://khanlab.co.technology/) · [Source and issues](https://github.com/mohammadrezwankhan/datacenter-twin-lab) · [Model assumptions](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/main/docs/engineering/calculation-boundaries.md)**

The `datacenter-twin` Python package is the deterministic calculation core of
Datacenter Twin Lab. It models utility loss, generator startup or failure, finite
battery reserves, surviving power paths, shared failures, and recovery. Python
3.12 or later is required. The core has no third-party runtime dependencies.

## Install and run

```sh
python -m pip install datacenter-twin
python -m datacenter_twin simulate --preset generator_failure
datacenter-twin simulate --preset generator_failure --format html --output failure.html
datacenter-twin sweep --preset generator_failure --parameter battery_initial_kwh --values 0 50 100 --format markdown
```

The bundled `generator_failure` preset loses utility at 300 seconds. A full
100 kWh battery delivers 85.5 kWh to the 1 MW IT load after discharge and
distribution losses. It sustains the load for **307.8 seconds after the outage**,
then depletes at **607.8 seconds elapsed**. The report includes the scenario,
input hash, event timeline, and a zero-residual energy ledger.

The preset permits charging before the outage. Its 50 kWh sweep point therefore
differs from the browser lesson's charging-disabled 50 kWh challenge. See the
[canonical worked case](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/main/docs/canonical-case.md)
for the exact recipe and the distinction between elapsed time and ride-through.

The CLI also supports bounded sensitivity sweeps and Markdown, HTML, and JSON
reports. Use `datacenter-twin --help` to discover commands. Choose a fresh
output path; replacement requires the explicit `--force` flag.

## Browser and optional studies

The [free static website](https://khanlab.co.technology/) provides twelve power
continuity lessons, a DC-link RLC lesson, and a power-dynamics research studio.
The PyPI wheel contains the Python core and resources; it does not bundle the
website or a shared simulation service.

Optional converter and network studies use NumPy and SciPy:

```sh
python -m pip install "datacenter-twin[studies]"
python -m datacenter_twin.research --help
```

[Study equations and reproduction commands](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/main/docs/studies/power-dynamics.md)
describe the separate models and their assumptions. The continuity engine
itself does not simulate electromagnetic transients.

## Scope and provenance

These are synthetic educational models with explicit inputs and software
reproduction checks. They do not establish facility calibration, protection
coordination, certified uptime, equipment safety, GPU job performance, or grid
adequacy. Independent external reproduction remains pending.

Written by Mohammad Rezwan Khan with AI-assisted development. Source code is
licensed under Apache-2.0; separately identified reference material is not
included in the package. Historical GitHub release wheels use the distribution
name `datacenter-twin-lab`; use a fresh environment when switching to
`datacenter-twin`, because both provide the same Python module and CLI.

[Contribute](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/main/CONTRIBUTING.md)
or [report a reproducible issue](https://github.com/mohammadrezwankhan/datacenter-twin-lab/issues).
