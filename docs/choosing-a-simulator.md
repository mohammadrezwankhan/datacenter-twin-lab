# Choosing a simulator for the question

The right tool depends on the question you need to answer and the inputs you can defend.

| If your task is… | Start with… | Inputs or question to prepare |
| --- | --- | --- |
| Learn event timing and energy accounting for a synthetic continuity case | [Datacenter Twin Lab](../README.md) | Aggregate IT demand in kW, stored battery energy in kWh, source/path capacities, efficiencies, and event boundaries. Ask how much load is served, when storage depletes, or how a path limit changes unserved energy. |
| Explore cloud datacenter behavior and performance scenarios | [OpenDC](https://opendc.org/) | Define the datacenter scenario and the performance question. OpenDC's official site describes online cloud datacenter modeling, exploratory simulation, and scenarios involving cloud, serverless, big data, and machine learning. |
| Simulate or optimize a broader power and energy system | [PyPSA](https://docs.pypsa.org/latest/) | Define network components, time series, constraints, objective, and planning horizon. PyPSA's official documentation describes simulation and optimization with generators, unit commitment, storage, sector coupling, and linearized power flow, aimed at researchers, planners, and utilities. |

## When Datacenter Twin Lab fits

Choose Datacenter Twin Lab when the immediate learning question is about continuity at an IT boundary: a finite reserve, a generator delay or failure, a surviving distribution path, a shared failure domain, or the energy ledger around explicit events. The browser lessons and the Python reference route expose the units and hand calculations so a reader can follow the result before changing assumptions.

Use the [scenario catalog](scenarios/index.md) for the current cases and the [continuity walkthrough](tutorials/continuity-walkthrough.md) for the 665 kW surviving-path and 307.8 s battery examples.

## When OpenDC fits

Choose OpenDC when you need to explore datacenter performance questions in the domain described by its official site, such as cloud, serverless, big-data, or machine-learning scenarios. Its online interface, exploratory simulation, and generated visual summaries are useful starting points for that task. Read the [OpenDC site](https://opendc.org/) for its current models, tutorials, and documentation.

## When PyPSA fits

Choose PyPSA when the question requires a power or energy-system network, time series, optimization constraints, storage operation, unit commitment, sector coupling, or linearized power-flow analysis. The [PyPSA documentation](https://docs.pypsa.org/latest/) lists these areas and provides user guides, examples, and API reference material for researchers, planners, and utilities.

## Shared assumptions and limits

These tools answer different questions through different model boundaries. Datacenter Twin Lab's public fixtures are deterministic, synthetic, and centered on one aggregate IT load with explicit continuity events, finite storage, conversion losses, path limits, and exact energy accounting. They do not establish GPU job throughput, grid adequacy, equipment suitability, cooling behavior, facility calibration, certification, or physical safety. A 50 MW AI-cluster case in this repository is a scaled teaching input, not a site model.

OpenDC and PyPSA should be assessed from their current official documentation and the specific model you construct. This page does not claim a feature-by-feature equivalence, a head-to-head benchmark, measured speed, or that one tool replaces another. For any tool, state the data source, units, time resolution, objective, assumptions, validation evidence, and decision boundary before treating an output as engineering evidence.

Official pages checked **2026-09-12**: [OpenDC](https://opendc.org/) and [PyPSA documentation](https://docs.pypsa.org/latest/).
