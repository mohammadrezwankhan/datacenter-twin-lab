# Datacenter Twin Lab continuity report

Model: single\_load\_electrical\_continuity\_v1
Engine version: 0.3.0a0
Run ID: b93b91d64b3fc0bbd96b
Input SHA-256: 202d1950bc8762c95216904dd9bbc890c1e1cdb51fe3f824e6e3d98f76410195

## Outcome

| Measure | Value | Unit |
| --- | --- | --- |
| Requested IT energy | 500 | kWh |
| Served IT energy | 418.8333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333 | kWh |
| Unserved IT energy | 81.16666666666666666666666666666666666666666666666666666666666666666666666666666666666666666666666667 | kWh |
| Unserved duration | 292.2 | s |
| First battery depletion | 607.8 | s |
| Battery final energy | 23.75 | kWh |
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
| 607.8 | battery\_depleted | battery | simulation |  |
| 900 | asset\_up | utility | scenario\_event |  |
| 900 | asset\_up | generator | scenario\_event |  |

## Scenario assumptions

| Field | Value | Unit |
| --- | --- | --- |
| id | demo\-generator\_failure |  |
| name | Generator failure / battery depletion |  |
| currency | USD |  |
| duration\_s | 1800 | s |
| step\_s | 10 | s |
| it\_demand\_kw | 1000 | kW |
| it\_capacity\_kw | 1000 | kW |
| distribution\_efficiency | 0.95 | ratio |
| generator\_start\_delay\_s | 30 | s |
| battery\_capacity\_kwh | 100 | kWh |
| battery\_initial\_kwh | 100 | kWh |
| battery\_charge\_kw | 100 | kW |
| battery\_charge\_efficiency | 0.95 | ratio |
| battery\_discharge\_efficiency | 0.9 | ratio |
| tariff\_per\_kwh | 0.1 | currency/kWh |
| generator\_cost\_per\_kwh | None | currency/kWh |

## Warning summary

| Warning | Count |
| --- | --- |
| BATTERY\_EMPTY | 31 interval\(s\) |
| UNSERVED\_IT\_LOAD | 30 interval\(s\) |
| UTILITY\_UNAVAILABLE | 61 interval\(s\) |

## Assumptions


## Limitations

- No switching transient, protection study, cooling, workload queue or certification model.
- Generator starts on utility\-asset unavailability only; downstream path faults do not request a start.
- Generator fuel is assumed sufficient for this horizon; its unit energy cost may be unknown.
- Initial stored battery energy is an opening balance; prior charging cost is excluded.
- Prices are illustrative inputs; costs exclude CAPEX and non\-energy charges.
