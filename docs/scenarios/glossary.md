# Electrical terms in the scenario catalog

Use this glossary alongside the [five synthetic scenarios](index.md). The terms describe this uncalibrated software model; they do not establish equipment suitability, facility reliability, or certification.

| Term | Unit or kind | Meaning in this model |
| --- | --- | --- |
| IT demand | kW | Electrical power requested by the aggregate IT load during an interval. It is an input assumption, not a prediction of workload or GPU performance. |
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

Reproduce the case from a source checkout with Python 3.12+:

```sh
python -m datacenter_twin simulate --preset path_maintenance --format markdown
```

The report should show 335 kW peak unserved power, 600 s unserved duration, 55.833333… kWh unserved IT energy, and a zero energy-balance residual. All ratings, demand, and efficiency here are synthetic assumptions; this is not a maintenance or equipment recommendation.
