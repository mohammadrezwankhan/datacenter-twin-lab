# Datacenter Twin Lab continuity report

Model: single\_load\_electrical\_continuity\_v1
Engine version: 0.4.0rc1
Run ID: ad6fc2898ce61f96406c
Input SHA-256: 6b446789e2f755b9ac1ac81896c7f0d85827a9a03b6ceedfd8fbdc6cb3b775dd

## Outcome

| Measure | Value | Unit |
| --- | --- | --- |
| Requested IT energy | 500 | kWh |
| Served IT energy | 444.1666666666666666666666666666666666666666666666666666666666666666666666666666666666666666666666667 | kWh |
| Unserved IT energy | 55.83333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333 | kWh |
| Unserved duration | 600 | s |
| First battery depletion | none | s |
| Battery final energy | 100 | kWh |
| Peak unserved demand | 335 | kW |
| Service status | unserved\_load |  |
| Cost status | illustrative |  |
| Cost unknowns | none |  |
| Energy balance residual | 0 | kWh |

## Event timeline

| At (s) | Action | Target | Origin | Ready at (s) |
| --- | --- | --- | --- | --- |
| 300 | asset\_down | path\-a | scenario\_event |  |
| 900 | asset\_up | path\-a | scenario\_event |  |

## Scenario assumptions

| Field | Value | Unit |
| --- | --- | --- |
| id | demo\-path\_maintenance |  |
| name | A\-path maintenance / surviving overload |  |
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
| UNSERVED\_IT\_LOAD | 60 interval\(s\) |

## Assumptions


## Limitations

- No switching transient, protection study, cooling, workload queue or certification model.
- Generator starts on utility\-asset unavailability only; downstream path faults do not request a start.
- Generator fuel is assumed sufficient for this horizon; its unit energy cost may be unknown.
- Initial stored battery energy is an opening balance; prior charging cost is excluded.
- Prices are illustrative inputs; costs exclude CAPEX and non\-energy charges.
