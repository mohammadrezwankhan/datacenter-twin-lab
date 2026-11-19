# API, CLI and interface contracts

Source snapshot: `d8dc3773830a397409a7a9c00a6ffed33c46fb4b`, 19 November 2026. This page maps the supported entry points and their distinct data contracts. The machine-readable author handoff additionally accounts for explicit module exports, methods, CLI declarations, schemas and dynamic UI/worker boundaries. An exported implementation helper is not automatically a stable third-party API.

## Command-line entry points

`datacenter-twin` and `python -m datacenter_twin` call the same `main(argv)` entry. [pyproject.toml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/pyproject.toml), [datacenter_twin/cli.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/cli.py).

| Command | Inputs/options | Result |
| --- | --- | --- |
| `--version` | No scenario | Declared engine version |
| `run SCENARIO` | Schema 1 JSON path | Planning JSON with a timestamp outside `result` |
| `compare BASELINE ALTERNATIVE` | Two schema 1 paths; identical currency and ordered hours/IT loads | Baseline minus alternative energy/cost quantities; no exchange-rate conversion |
| `simulate` | Mutually exclusive `--scenario PATH` / `--preset ID`; default preset `utility_loss` | Schema 2 continuity; `--format json\|markdown\|html` |
| `sweep` | Scenario/preset, default `generator_failure`; required `--parameter` and `--values` | One-field sensitivity; 1–20 unique normalized values in caller order; same three output formats |
| `serve` | `--port`, default 8000, range 1–65535 | Local API and built dashboard on `127.0.0.1` |
| `python -m datacenter_twin.emt` | `--preset` (default `voltage-sag`) or `--config PATH` | Ideal circuit JSON |
| `python -m datacenter_twin.research` | Required `--study`; optional `--config PATH` of bounded overrides | Scientific study JSON; optional NumPy/SciPy dependencies |

Run/compare/simulate/sweep and the separate study CLIs support `--output PATH` and `--force`; `--force` requires an output. Existing destinations are protected by default, and protected input aliases/output symlinks are rejected. A complete temporary result is flushed before hard-link publication or forced `os.replace`. The filesystem guarantees and limits are detailed in the preserved [security policy](../../SECURITY.md). Domain/input errors in the main CLI return status 2. [datacenter_twin/output.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/output.py), [datacenter_twin/emt.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/emt.py), [datacenter_twin/research/__main__.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/__main__.py).

The four sweep parameters are `battery_initial_kwh`, `it_demand_kw`, `generator_start_delay_s`, and `distribution_efficiency`. Generator delay values must be whole seconds. Full run payloads are omitted together if the sweep's 16 MiB result budget is exceeded; summaries and `full_results_included` explain that change. The advanced UI's path-capacity comparison constructs separate simulations; it does not add a fifth CLI sweep parameter. [datacenter_twin/sensitivity.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/sensitivity.py), [apps/web/src/RunTools.tsx](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/RunTools.tsx).

## JSON contracts and normalization

| Contract | Required distinctions | Boundaries |
| --- | --- | --- |
| Schema 1 `Scenario` / `Segment` | Assumed PUE, ordered hours/IT load, currency, tariff status/date/source IDs | PUE ≥ 1; up to 10,000 segments; empty/zero-IT cases have explicit undefined PUE; USD/EUR/INR are labels, not conversion services |
| Schema 2 `SiteScenario` | Assets, `feeds`/`requires` DAGs, one utility/generator/battery/load, explicit `charges` edge, ordered events | Duration 1–86,400 s, step 1–3,600 s, at most 2,000 regular intervals, 64 assets, 256 dependencies and 128 events |
| Scalar decimal inputs | Finite numbers or decimal-compatible text, no Boolean coercion | Representation ≤ 128 characters, magnitude ≤ 10¹², ≤ 9 fractional places; field-specific sign/range rules |
| EMT configuration | Exactly ten named fields; SI-prefixed inputs converted explicitly | Accepted step choices and event/horizon limits in [parameters](../math-and-physics/PARAMETERS_AND_SYMBOLS.md) |
| Research overrides | Study-specific finite bounded fields only | Unknown keys and nonfinite nested result values are rejected |

Native Python reads at most 4 MiB and rejects duplicate JSON keys, malformed encodings and excessive nesting. The native JavaScript worker's raw JSON route uses `JSON.parse`; do not extend Python's duplicate-key guarantee to every browser import path. The scenario file picker has a separate **10 MiB** file-read limit; a later worker/API body still has its own 4 MiB envelope. Imported results/hashes are not trusted as replacements for recalculation. [datacenter_twin/contracts.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/contracts.py), [datacenter_twin/topology.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/topology.py), [apps/web/src/javascript-worker.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/javascript-worker.ts), [apps/web/src/ScenarioFiles.tsx](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/ScenarioFiles.tsx), [existing schema 1](../contracts/scenario-v1.md), [existing schema 2](../contracts/electrical-v2.md).

## Local HTTP API

`create_app()` declares nine business routes. Swagger/ReDoc are disabled; the constructor does not explicitly disable FastAPI's OpenAPI URL, so do not claim that all framework-generated metadata endpoints are absent. The supported local contract is documented in [local-api.md](../contracts/local-api.md). [datacenter_twin/api.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/api.py).

| Method and path | Request | Response |
| --- | --- | --- |
| `GET /api/v1/health` | None | Health/version metadata |
| `GET /api/v1/presets` | None | Preset IDs and names |
| `GET /api/v1/demo` | Optional `preset`, default `utility_loss` | Scenario input |
| `GET /api/v1/catalog` | None | Bundled dated catalog |
| `POST /api/v1/simulations` | Schema 2 scenario | Completed continuity run |
| `POST /api/v1/planning` | Schema 1 scenario | Planning result |
| `POST /api/v1/reports` | Exactly `scenario` and `format` (`markdown` or `html`) | Recomputed report text, format and run ID |
| `POST /api/v1/sweeps` | Exactly `scenario`, `parameter`, `values` | Bounded sensitivity result |
| `POST /api/v1/quotes/normalize` | Offering/rate assumptions in the catalog contract | Unit-normalized quote with explicit unknowns |

Malformed/domain inputs are returned as 422 errors. The API enforces streamed input size, loopback Host validation, local Vite CORS origins, cache prevention and its configured content policy. A two-slot semaphore surrounds simulations, reports and sweeps. This is a local queue boundary, not multi-tenant scheduling or authentication. The CLI supplies loopback binding; `create_app()` does not bind a network socket. There are **no EMT or research REST endpoints**. [datacenter_twin/api.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/api.py), [datacenter_twin/browser.py:20–35](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/browser.py#L20-L35), [datacenter_twin/catalog.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/catalog.py).

## Native Python library families

| Module / public entry | Contract to retain |
| --- | --- |
| `contracts`: `Scenario`, `Segment`, `InputError`, `number`, `parse_json_document`, `load_json_document`, `load_scenario`, `decimal_text` | Strict planning/input representation and explicit errors |
| `topology`: `Asset`, `Dependency`, `Event`, `SiteScenario`, `topological_order`, numeric/list validators | Schema 2 topology and event invariants before simulation |
| `engine`: `simulate`, `compare` | Planning values and like-for-like comparison; no continuity inference |
| `continuity`: `simulate_continuity`, `SimulationRun`, `FlowNetwork`, quantity/currency formatters | Exact rational model and deterministic serialization; low-level flow helpers assume their specified inputs |
| `demo`: `demo_scenario`, `FacilityProfile` | Named synthetic inputs; profiles scale ratings/demand/reserve, not compute performance |
| `sensitivity`: `sweep_continuity` | Validated one-field changes from the same original scenario |
| `reporting`: `render_markdown`, `render_html` | Continuity/sweep presentation with escaped fields, units and limitations |
| `catalog`: `load_catalog`, `normalize_quote` | Bundled provenance and declared billing units; no live price fetch |
| `calculations`: `node_charge`, `token_charge`, `battery_runtime_hours`, `steady_heat_kw`, `NodeCharge` | Unit-labelled arithmetic; zero-load battery duration returns `None` |
| `output`: `write_result` | Protected paths, explicit overwrite and atomic publication behavior |
| `browser`: `dispatch_json`, `scenario_report`, `scenario_sweep` | Fixed JSON operations; no caller-provided Python program |
| `emt`: `validate_config`, `simulate_emt`, `EMTResult` | Ideal circuit/configuration contract, separate from continuity |
| `spectrum`: `spectrum` | Real-record single-sided amplitude spectrum; duration is inclusive endpoint span |
| `research`: `run_study` and study-specific numerical/helper/type modules | Five configured studies; equilibrium, finite-state and conditioning diagnostics; helper exports do not imply a new public study |

Canonical implementations: [datacenter_twin/contracts.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/contracts.py), [datacenter_twin/topology.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/topology.py), [datacenter_twin/engine.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/engine.py), [datacenter_twin/continuity.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/continuity.py), [datacenter_twin/calculations.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/calculations.py), [datacenter_twin/research/__init__.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/__init__.py). Definitions and their members remain source-located in the structured interface inventory; imported aliases and type-only declarations are distinguished from execution.

## Browser modules, controls and exports

`js-engine/index.ts` is the native numerical export barrel: rational/canonical helpers, validation, planning, continuity, sweeps, reports, quote normalization and corresponding types. The TypeScript parser used for the author inventory was version 5.9.3; syntax parsing did not run the repository's TypeScript 7.0.2 compiler or resolve all dynamic imports. [apps/web/src/js-engine/index.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/js-engine/index.ts), [apps/web/package.json](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/package.json).

| Surface | Public/control behavior | Verification boundary |
| --- | --- | --- |
| Guide and continuity course | Predict, run, inspect completed result, compare reserve, export; lesson 3 disables charging | Native engine comparisons executed; fresh click/keyboard journeys remain separate browser checks |
| Advanced workspace | Presets/profiles, bounded edits, imports, ordered demand events, baseline, replay, JSON/report/sweep export | Replay is presentation of calculated intervals; comparable-cost guards require matching assumptions |
| Infrastructure course | Numeric screens, source labels, prediction, frozen report and six review states with reasons | `calculateScreen('releaseGate', states)` accepts string states; `buildScreenResult` accepts numeric lesson inputs and rejects those states |
| EMT | Draft validation, native result, explicit re-run, replay/seek, refinement and optional Python comparison | Initial default result is calculated on mount; changing a draft does not replace it |
| Dynamics | Five study choices, finite bounded drafts, explicit run, solver feedback, completed JSON/CSV | Scientific worker is loaded separately; dirty drafts remain visibly distinct from applied configuration |
| Course/discovery registry | 24 course entries; EMT + five dynamics items yield 30 learning items in discovery | Eighteen presets are a different catalog; the offline companion has four modules |
| Legacy companion globals | `LabSimulation` exposes specs/parameter resolution/evaluation/checkpoints; `LabDashboard` exposes read-only state and pure evaluator hooks | Active model is `cooling`; other shared evaluator kinds are not the selected datacenter lesson model |

The release-gate wrapper mismatch is an existing interface limitation, not a current lesson failure: the twelve infrastructure lessons use numeric models and lesson 24 uses `designReview`. It is recorded as proposed code work in [technical debt](../maintainer/FAILURE_MODES_AND_TECH_DEBT.md), without modifying the implementation. [apps/web/src/infrastructure/screens.ts:679–717](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/infrastructure/screens.ts#L679-L717), [apps/web/src/infrastructure/screens.ts:796–838](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/infrastructure/screens.ts#L796-L838), [apps/web/src/infrastructure/InfrastructureCourse.tsx](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/infrastructure/InfrastructureCourse.tsx), [apps/web/src/curriculum.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/curriculum.ts), [apps/web/learn-manifest.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/learn-manifest.ts), [docs/index.html:494–495](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/index.html#L494-L495).

Reports escape HTML/Markdown text. EMT CSV carries model, applied configuration and assumptions with each row; research CSV adds study, solver and chart labels. These are exports of completed results, not full restart checkpoints for an external solver. [apps/web/src/js-engine/report.ts:236–417](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/js-engine/report.ts#L236-L417), [apps/web/src/result-csv.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/result-csv.ts), [apps/web/src/lesson-worksheet.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/lesson-worksheet.ts).

## Build and maintenance interfaces

The existing scripts expose lock/installed checks, fresh evidence build/verify, demand-timing reproduction, continuity benchmarking, wheel verification, public-site auditing and Pages redirect building. Network fetches and live-site audits are opt-in operations with their own evidence, not side effects of simulation. The course registry's `--check` detects staleness; omitting it writes the generated catalog. See [scripts/sync_course_registry.mjs](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/sync_course_registry.mjs), [scripts/fetch_study_runtime.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/fetch_study_runtime.py), [scripts/build_evidence.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/build_evidence.py), [scripts/reproduce_demand_timing.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/reproduce_demand_timing.py), [scripts/benchmark_continuity.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/benchmark_continuity.py), [scripts/verify_distribution.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/verify_distribution.py), [scripts/audit_public_site.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/audit_public_site.py) and [the maintenance runbook](../maintainer/DOCS_MAINTENANCE_RUNBOOK.md).
