# Scenario contract v1

The executable validator is `datacenter_twin/contracts.py`. Unknown and duplicate fields are rejected. A scenario has exactly these fields:

| Field | Meaning |
| --- | --- |
| `schema_version` | Integer 1 |
| `id`, `name` | Nonempty identifiers/display text, at most 200 characters each |
| `currency` | USD, EUR or INR; no exchange conversion |
| `it_capacity_kw` | Positive planning envelope, not a verified source or distribution rating |
| `tariff_per_kwh` | Nonnegative assumed currency per facility kWh, or null |
| `price_status` | `illustrative` for a price; `unknown` for a null price |
| `assumption_date` | Valid YYYY-MM-DD date of the scenario assumption, not proof of market freshness |
| `source_ids` | 1–100 identifiers; provenance references, not automatic source verification |
| `segments` | Ordered list of 0–10,000 piecewise constant intervals |

Each segment has exactly `label`, `hours`, `it_load_kw`, and `assumed_pue`. Hours must be positive, IT load nonnegative, PUE at least one. Empty scenarios and zero IT demand are permitted and produce undefined PUE. Demand can exceed the capacity envelope; the result flags this without claiming delivered power.

Input quantities may be JSON numbers or decimal strings. Canonical inputs and numerical outputs use decimal strings. Each quantity is bounded at 1e12 and at most nine fractional places as a computational constraint. Numeric representations longer than 128 characters are rejected before decimal parsing. Non-finite values, booleans and negative quantities are rejected. Export/signed flow is not implemented.

Validation and decimal normalization also run when constructing `Scenario` or `Segment` directly in Python. Use decimal strings or Decimal values for exact inputs; a float is normalized from its string representation without fixed-six-place formatting. Source/segment collections are copied into immutable tuples. Scenario JSON must be an existing regular file of at most 4 MiB, in UTF-8 with an optional BOM. Excessive nesting and malformed encoding are reported as `InputError`.

The result schema includes the scenario, interval ledger, units in field names, source IDs, model version, input SHA-256 and run ID. `generated_at_utc` is CLI export metadata and intentionally changes on each invocation; the nested result is deterministic. A run ID changes with canonical scenario input or engine version.

Version 0.1.0a1 preserves schema v1 but uses a 100-significant-digit calculation context. Engine version and run IDs distinguish these results from 0.1.0a0; repeating ratios may have longer decimal strings. The CLI now requires `--force` to replace existing result files.

Schema v1 has no calendar-dependent tariff, source availability, model family, topology, uncertainty distribution, or live telemetry field. These require new versioned contracts rather than overloading the current fields.
