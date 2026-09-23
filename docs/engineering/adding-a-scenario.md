# Add one teachable scenario

Start with a small JSON case and a question someone can answer by hand. A new scenario normally needs no new engine or plugin framework.

## First contribution

1. Run the [canonical evidence packet](../canonical-case.md) and copy one generated scenario JSON to a new local filename.
2. Change one documented input: a reserve, a start delay, a distribution capacity or an explicit event time. Keep quantities and source IDs intact.
3. Write the question and one expected outcome before running it. For example, a surviving 700 kW path at 0.95 efficiency can deliver at most 665 kW to IT.
4. Run the file with `python -m datacenter_twin simulate --scenario YOUR-SCENARIO.json` and inspect the completed input, event timeline and ledger. Use `--format markdown` or `--format html` to share a readable report.

A documentation correction or clear first-run report is also welcome. You do not need to implement a new numerical method for your first contribution.

## Existing extension points

| Change | Where it belongs |
| --- | --- |
| A new input-only case | A schema-2 scenario JSON using the [electrical contract](../contracts/electrical-v2.md) |
| A bundled, named preset | `datacenter_twin/demo.py`: `PRESETS` and `demo_scenario`; include a numerical expectation and scenario documentation |
| A lesson using existing behavior | `apps/web/src/course-lessons.ts`; provide question, bounded input, challenge and explanation |
| A visual theme | `apps/web/src/course-themes.ts`; keep readable labels and an accessible nonvisual equivalent |
| Browser fixture preparation | `scripts/prepare_browser_demo.py` reads the same Python presets; do not hand-maintain a second fixture database |
| A change to accounting | Python and JavaScript implementations, contract, independent expectations, and complete-result parity tests together |

The browser tests compare full exported objects with native Python, including inputs and hashes. A screenshot alone cannot establish numerical agreement. Tests should target an observable edge case or invariant, not reproduce implementation branches.

## Boundaries for extensions

The continuity model represents one aggregate IT load and explicit asset/feed dependencies. Demand steps are inputs, not GPU workload predictions. Solar, fuel, generator dynamics, grid-forming behavior, switching transients, protection studies or facility telemetry require separate contracts and evidence before becoming model features.

Use original synthetic inputs or references with clear reuse rights. Never include credentials, private facility traces, licensed standards text or a proprietary manual. Describe the tested scope and unresolved questions in the pull request.
