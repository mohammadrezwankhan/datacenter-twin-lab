# Deterministic continuity sensitivity sweeps

The schema-2 continuity model can evaluate one scenario field at a time with
`datacenter_twin.sensitivity.sweep_continuity`. Every value is applied to the
same validated `SiteScenario`; the function never mutates the caller and never
uses a previous run as the next run's starting state.

```python
from datacenter_twin.demo import demo_scenario
from datacenter_twin.sensitivity import sweep_continuity

result = sweep_continuity(
    demo_scenario("generator_failure"),
    "battery_initial_kwh",
    ["0", "50", "100"],
)
for run in result["runs"]:
    print(run["value_label"], run["summary"]["unserved_kwh"])
```

The supported fields and units are:

| Parameter | Unit | Validation |
| --- | --- | --- |
| `battery_initial_kwh` | kWh | nonnegative and no greater than the fixed battery capacity |
| `it_demand_kw` | kW | nonnegative; the existing IT envelope warning still applies |
| `generator_start_delay_s` | s | integer from 0 through 86,400 |
| `distribution_efficiency` | ratio | greater than 0 and at most 1 |

At most 20 nonempty values are accepted. Decimal strings and integers are
normalised to stable labels; duplicate normalised values, booleans, NaN,
infinity, fractional delay seconds, and values rejected by `SiteScenario` are
errors. The result records the base scenario and input hash, each run's
scenario input hash and identifier, exact ledger summary, service and cost
status, and the first battery depletion event when one occurs. Full run
intervals are included while the bounded result remains within the report size
limit; otherwise summaries remain available with `full_results_included` set to
`false`.

The command-line equivalent is:

```sh
python -m datacenter_twin sweep \
  --preset generator_failure \
  --parameter battery_initial_kwh \
  --values 0 50 100 \
  --format markdown \
  --output outputs/battery-sweep.md
```

Use `--scenario path/to/schema-2.json` instead of `--preset` for an explicit
input. Output paths use the same protected-input, existing-file, symbolic-link,
and atomic-write rules as the other CLI commands; use `--force` only when
replacement is intentional. Markdown and HTML are deterministic for the same
validated inputs. JSON keeps the CLI's generated-at wrapper for compatibility.

This feature describes synthetic single-IT-load continuity only. It does not
calibrate equipment, predict workload or cooling behavior, model AC transients
or protection, estimate fuel availability, or operate a physical facility.
