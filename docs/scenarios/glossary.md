# Electrical terms in the scenario catalog

**Start with the terms used in the 50 MW AI-cluster question, then work through the reference calculation.**

| Term | Unit or kind | Meaning in this model |
| --- | --- | --- |
| IT demand | kW | Electrical power requested by the aggregate IT load during an interval. It is an input assumption, not a prediction of workload, GPU throughput, or performance. |
| Gross path capacity | kW | Maximum electrical power a declared path can carry before the model's distribution losses. A surviving path's gross capacity can therefore exceed the power delivered at the IT boundary. |
| Distribution efficiency | Dimensionless ratio, greater than 0 and at most 1 | The fraction of dispatched gross electrical power delivered at the IT boundary. For example, 0.95 means 95% is delivered and 5% is accounted for as distribution loss. |
| Stored battery energy | kWh | Energy held inside the modeled battery at a stated time, before discharge and distribution losses. Charging adds stored energy and discharging removes it. |
| Served IT power | kW | Power actually delivered to the modeled IT load during an interval. Source availability, battery limits, and surviving path capacity can limit it. |
| Unserved IT power | kW | The nonnegative difference between requested and served IT power. Multiplying this deficit by an interval's duration in hours gives that interval's unserved IT energy in kWh. |
| Event boundary | s elapsed from simulation start | A time at which a declared event or an automatic transition takes effect. The engine splits intervals at these boundaries so the next interval uses the updated state. |
| Shared failure domain | Grouping label; no physical unit | A label grouping assets affected by the same declared domain failure or recovery event. Two supply paths can become unavailable together when they share a failed domain. |

Power (**kW**) is a rate; energy (**kWh**) accumulates over time. Battery opening/closing energy belongs to a stated interval boundary, while served/unserved power describes dispatch over the interval; see the [interval contract](../contracts/electrical-v2.md).

## Worked example: ten minutes with one path unavailable

In [`path_maintenance`](path_maintenance.md), IT demand is 1,000 kW and the surviving path has 700 kW gross capacity at 0.95 distribution efficiency. Path A is unavailable from 300 s until 900 s, a 600 s interval:

```text
Served IT power   = 700 kW × 0.95 = 665 kW
Unserved IT power = 1,000 kW − 665 kW = 335 kW
Duration          = (900 s − 300 s) / 3,600 s/h = 1/6 h
Unserved energy   = 335 kW × 1/6 h = 335/6 kWh = 55.833333… kWh
```

The 335 kW figure describes the deficit during the outage. The 55.833333… kWh figure describes the total unserved energy over those ten minutes; the interval duration is necessary to convert between them.

## Worked example: scaled aggregate AI-cluster reserve

The browser teaching case scales the reference fixture by 50×:

```text
IT demand              = 50,000 kW = 50 MW
initial stored energy  = 5,000 kWh = 5 MWh
IT-boundary energy     = 5,000 kWh × 0.90 × 0.95 = 4,275 kWh
ride-through duration  = 4,275 kWh / 50,000 kW × 3,600 s/h = 307.8 s
depletion boundary    = 300 s + 307.8 s = 607.8 s
```

The scale-up preserves the synthetic ratios. It does not establish GPU throughput, grid adequacy, equipment selection, cooling performance, or facility calibration.

Reproduce the 1 MW reference case from a source checkout with Python 3.12+:

```sh
python -m datacenter_twin simulate --preset path_maintenance --format markdown
python -m datacenter_twin simulate --preset generator_failure --format markdown
```

The reference report should show 335 kW peak unserved power, 600 s unserved duration, 55.833333… kWh unserved IT energy, and a zero energy-balance residual for `path_maintenance`. The generator-failure report should show 307.8 s ride-through and depletion at 607.8 s. All ratings, demand, and efficiency here are synthetic assumptions.

## Assumptions and limits

The terms describe an uncalibrated software model. The 1 MW reference fixture uses 1,000 kW demand, 700 kW gross paths, 0.95 distribution efficiency, 100 kWh stored battery energy, 0.90 discharge efficiency, explicit event boundaries, and a fictional tariff. The 50 MW teaching case uses 50,000 kW and 5,000 kWh with the same ratios. These values are not selected-equipment ratings, live prices, a benchmark, a maintenance recommendation, a certification, legal-compliance evidence, or a real-site calibration.

The model does not cover GPU throughput, workload prediction or queues, cooling, battery aging, temperature, generator ramp/cooldown/fuel dynamics, transfer and switching transients, AC load flow, impedance-based load sharing, protection coordination, harmonics, short-circuit and arc-flash studies, reliability probabilities, Tier claims, service-level claims, physical controls, or physical safety. It does not establish equipment suitability, facility reliability, or certification.

The browser default uses exact JavaScript arithmetic. **Verify against Python** is an optional on-demand Pyodide cross-check when supplied by the deployed build; it is not needed for the initial browser result. The browser has no shared simulation backend or client analytics, and the API binds to loopback. Independent external review, formal security audit, facility measurements, validation data, and physical calibration are absent. Unknown costs and unavailable quantities remain explicit.

Original code and synthetic fixtures use [Apache-2.0](../../LICENSE). See [NOTICE](../../NOTICE), [synthetic provenance](../../data/provenance/manifest.json), and [browser runtime licenses](../third-party/README.md).
