# Datacenter Twin

Reproduce a datacenter power outage, inspect the energy ledger, and export a report.

**[Try the browser course](https://khanlab.co.technology/) · [Source and issues](https://github.com/mohammadrezwankhan/datacenter-twin-lab) · [Model assumptions](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/main/docs/engineering/calculation-boundaries.md)**

The `datacenter-twin` Python package is the deterministic calculation core of
Datacenter Twin Lab. It models utility loss, generator startup or failure, finite
battery reserves, surviving power paths, shared failures, and recovery. Python
3.12 or later is required. The core has no third-party runtime dependencies.

## Install and run

PyPI publication is pending. For the latest published GitHub wheel, use the
[Python quickstart](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/main/docs/quickstart.md#run-the-released-dashboard-python-only),
which records the actual release URL, checksum and fresh-environment commands.
The package-index command `pip install datacenter-twin` is not available yet.

### Historical v2.0.0 reproduction

The recipe below preserves the original 12 October artifact. It predates the
odd-record spectrum correction and subsequent packaging/setup fixes. Version
[2.0.1](https://github.com/mohammadrezwankhan/datacenter-twin-lab/releases/tag/v2.0.1) was published on 2026-10-26; consult
the quickstart above for its checksum-pinned installation and maintenance scope.
Historical assets remain unchanged.

PyPI publication is pending. Use the published [v2.0.0 GitHub
wheel](https://github.com/mohammadrezwankhan/datacenter-twin-lab/releases/tag/v2.0.0)
with its pinned SHA-256 below. Start in a fresh Python 3.12+ environment; the
[quickstart](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/main/docs/quickstart.md#run-the-released-dashboard-python-only)
provides isolated PowerShell and POSIX instructions. The package-index command
`pip install datacenter-twin` is not available yet.

```sh
python -m pip install "datacenter-twin @ https://github.com/mohammadrezwankhan/datacenter-twin-lab/releases/download/v2.0.0/datacenter_twin-2.0.0-py3-none-any.whl#sha256=274e5a837ebcb2872c0d9bc0a40eb5db7092e9793bb97b075e17e73fa20e9393"
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

The [free static website](https://khanlab.co.technology/) provides twelve Infrastructure Engineering lessons in addition to twelve power
continuity lessons, a DC-link RLC lesson, and a power-dynamics research studio.
The published GitHub wheel also includes the local dashboard. The prepared
PyPI wheel contains the Python core and resources without the website. No
shared simulation service is included in either distribution.

Optional converter and network studies use NumPy and SciPy. Use the quickstart's
current wheel with its `studies` extra. The following pinned example is the
historical v2.0.0 reproduction, with the spectrum limitation described above:

```sh
python -m pip install "datacenter-twin[studies] @ https://github.com/mohammadrezwankhan/datacenter-twin-lab/releases/download/v2.0.0/datacenter_twin-2.0.0-py3-none-any.whl#sha256=274e5a837ebcb2872c0d9bc0a40eb5db7092e9793bb97b075e17e73fa20e9393"
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
