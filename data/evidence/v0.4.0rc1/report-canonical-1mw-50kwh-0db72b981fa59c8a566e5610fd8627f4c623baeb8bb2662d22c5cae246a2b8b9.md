# Datacenter Twin Lab continuity report

Model: single\_load\_electrical\_continuity\_v1
Engine version: 0.4.0rc1
Run ID: 21cd49da247b309f2b45
Input SHA-256: 0db72b981fa59c8a566e5610fd8627f4c623baeb8bb2662d22c5cae246a2b8b9

## Outcome

| Measure | Value | Unit |
| --- | --- | --- |
| Requested IT energy | 500 | kWh |
| Served IT energy | 376.0833333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333 | kWh |
| Unserved IT energy | 123.9166666666666666666666666666666666666666666666666666666666666666666666666666666666666666666666667 | kWh |
| Unserved duration | 446.1 | s |
| First battery depletion | 453.9 | s |
| Battery final energy | 0 | kWh |
| Peak unserved demand | 1000 | kW |
| Service status | unserved\_load |  |
| Cost status | illustrative |  |
| Cost unknowns | none |  |
| Energy balance residual | 0 | kWh |

## Event timeline

| At (s) | Action | Target | Origin | Ready at (s) |
| --- | --- | --- | --- | --- |
| 300 | asset\_down | utility | scenario\_event |  |
| 300 | asset\_down | generator | scenario\_event |  |
| 453.9 | battery\_depleted | battery | simulation |  |
| 900 | asset\_up | utility | scenario\_event |  |
| 900 | asset\_up | generator | scenario\_event |  |

## Scenario assumptions

| Field | Value | Unit |
| --- | --- | --- |
| id | course\-ride\-through |  |
| name | 3. Calculate battery ride\-through |  |
| currency | USD |  |
| duration\_s | 1800 | s |
| step\_s | 10 | s |
| it\_demand\_kw | 1000 | kW |
| it\_capacity\_kw | 1000 | kW |
| distribution\_efficiency | 0.95 | ratio |
| generator\_start\_delay\_s | 30 | s |
| battery\_capacity\_kwh | 100 | kWh |
| battery\_initial\_kwh | 50 | kWh |
| battery\_charge\_kw | 0 | kW |
| battery\_charge\_efficiency | 0.95 | ratio |
| battery\_discharge\_efficiency | 0.9 | ratio |
| tariff\_per\_kwh | 0.1 | currency/kWh |
| generator\_cost\_per\_kwh | None | currency/kWh |

## Warning summary

| Warning | Count |
| --- | --- |
| BATTERY\_EMPTY | 136 interval\(s\) |
| UNSERVED\_IT\_LOAD | 45 interval\(s\) |
| UTILITY\_UNAVAILABLE | 61 interval\(s\) |

## Assumptions


## Limitations

- No switching transient, protection study, cooling, workload queue or certification model.
- Generator starts on utility\-asset unavailability only; downstream path faults do not request a start.
- Generator fuel is assumed sufficient for this horizon; its unit energy cost may be unknown.
- Initial stored battery energy is an opening balance; prior charging cost is excluded.
- Prices are illustrative inputs; costs exclude CAPEX and non\-energy charges.
