# Continuity report contracts

`datacenter_twin.reporting.render_markdown(result)` and
`datacenter_twin.reporting.render_html(result)` accept either one
`SimulationRun.to_dict()` object or a sensitivity result from
`sweep_continuity`. They return a complete string with no clock, network,
telemetry, JavaScript, or external assets, so equal inputs produce equal bytes.

Reports identify the model and engine version, the run or base input SHA-256,
the scenario assumptions and units, energy service results, warning counts,
cost status and unknowns, assumptions, and limitations. A sweep adds its
parameter, unit, requested value labels, per-value served and unserved energy,
unserved seconds, battery depletion time, service status, and whether full
per-run details were retained.

The report boundary is the schema-2 synthetic electrical continuity model:
finite stored battery energy, generator delay or failure, conversion losses,
distribution path limits, and one IT load. A cost marked unknown remains
unknown in the report. Reports do not imply physical calibration, cooling or
workload prediction, AC transient analysis, certification, or control of
equipment.

Dynamic scenario identifiers, names, event warnings, and other values are
escaped for both output formats. HTML contains only inline presentation CSS;
there are no scripts or remote resources. Markdown cells escape table and
formatting characters and replace embedded line breaks with spaces.

The CLI exports reports with the existing atomic writer:

```sh
python -m datacenter_twin simulate \
  --preset generator_failure \
  --format html \
  --output outputs/generator-failure.html

python -m datacenter_twin sweep \
  --preset generator_failure \
  --parameter battery_initial_kwh \
  --values 0 50 100 \
  --format markdown \
  --output outputs/battery-sweep.md
```

The source checkout or an installed package containing this feature is
required. Existing released wheels should not be assumed to contain it until
their versioned release notes say so.
