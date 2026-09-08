# Calculation boundaries

This version estimates requested energy with an assumed-PUE multiplier. It does not model electrical supply, service delivery, or thermal transients.

For each interval:

```text
IT energy [kWh] = IT demand [kW] × interval [h]
Facility demand [kW] = IT demand [kW] × assumed PUE
Facility energy [kWh] = facility demand [kW] × interval [h]
Non-IT energy [kWh] = facility energy − IT energy
Period PUE = sum(facility energy) / sum(IT energy)
Energy-only cost [currency] = sum(facility energy) × tariff [currency/kWh]
```

The coarse overhead already includes cooling and electrical losses. Do not add them again. All facility demand is assumed imported from the grid. Period PUE is null when IT energy is zero. A constant PUE at zero load implies no fixed overhead in this coarse model; a future subsystem model must represent standby energy separately.

The screen compares peak requested IT demand with an assumed IT capacity envelope. Negative margin is an overload flag, not proof that a surviving supply path has been simulated. No IT demand is curtailed by the screen.

Money uses Decimal arithmetic with 100 significant digits and round-half-even. This covers products of up to four bounded inputs (each at most 1e12 with nine fractional places) summed over at most 10,000 intervals: at most 89 significant digits before monetary rounding. Independent rational-arithmetic tests exercise the upper input and interval-count boundaries. Round the aggregate energy charge once to two decimal places. Individual interval energy is not rounded to currency precision. Comparisons subtract rounded invoice totals. [Python Decimal documentation](https://docs.python.org/3.12/library/decimal.html) documents the arithmetic mechanism; it does not validate the engineering model.

Library-only primitives use the following independent boundaries:

- Node cost = billed node-hours × node-hour price. GPUs per node normalize the rate; they do not multiply a whole-node bill.
- Token cost = (input tokens × input rate + output tokens × output rate) / 1,000,000. No cached tokens, tools, retries or minimum charges are included.
- Idealized battery duration = already-deliverable energy at the load boundary / constant load. A stored-energy input would need efficiency and usable-state conversion first. This is not a stateful outage simulation.
- Steady heat transfer = mass flow × supplied specific heat × temperature rise. The fluid property is an assumption, not inferred from a cooling brand or product family.

All sample tariffs and demand profiles are illustrative. Unknown prices stay null and prevent a known comparison saving. There is no investment ranking, engineering certification, regional applicability determination, market pricing, or live-infrastructure claim.
