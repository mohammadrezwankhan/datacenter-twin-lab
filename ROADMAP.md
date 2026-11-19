# Roadmap

## Published maintenance release: v2.0.1

The [v2.0.1 maintenance release](https://github.com/mohammadrezwankhan/datacenter-twin-lab/releases/tag/v2.0.1)
was published on **26 October 2026**. Its [scope and publication receipt](docs/releases/v2.0.1.md)
record the checked numerical and packaging fixes. It adds no new model or public
schema and preserves the original v2.0.0 release assets and historical milestone.

## Published milestone: v2.0.0 — Infrastructure Engineering

Version **2.0.0** extends the teaching application with twelve Infrastructure Engineering lessons alongside twelve continuity lessons, one EMT lesson and five power-dynamics studies. The current [Learn catalog](https://khanlab.co.technology/learn/) contains these **30 learning items**; eighteen advanced facility presets are a separate catalog. It does not claim production reliability analysis, site validation, or independent review. Infrastructure content retains its source labels and **Engineering HOLD**. Review the supported release scope in [release readiness](docs/engineering/release-readiness.md) and the [educational publication decision](docs/releases/v2.0.0-publication-decision.md).

## Available in the current source and browser demo

| Capability                         | What is available                                                                                                                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Five-minute guided start           | Default first-visit route: predict, explicitly run, and explain a 1 MW / 100 kWh synthetic case. Compare the charging-disabled 50 kWh challenge.                                                           |
| Scenario catalog                   | Eighteen named cases, including five reference cases and facility-profile outage, demand-step, and extended-reserve cases for 50 MW, 200 MW, 30 MW, and 5 MW aggregate IT loads. All inputs are synthetic. |
| Advanced energy workspace          | Inspect an interactive isometric electrical scene, run and replay events, edit bounded assumptions, and export the completed result.                                                                       |
| Twelve continuity lessons          | Four course chapters with predictions, challenge values, selectable scenes, event replay, worked answers, and result exports.                                                                              |
| Twelve infrastructure lessons      | Bounded educational screens, original diagrams, 36 assessments and separate `infrastructure-screen-1` results. Source statement, Editorial derivation, Illustrative assumption and Unresolved labels remain visible. |
| EMT and power dynamics             | One DC-link RLC lesson and five separate converter/network studies. Their model assumptions and reproduction routes are distinct from the aggregate continuity engine. |
| Deterministic calculation          | Standard-library Python engine and exact JavaScript browser engine, with a Python comparison available on request. Full-result checks cover values, assumptions, and hashes.                               |
| Reports and sensitivity            | Export JSON, Markdown, and HTML; compare bounded reserve, efficiency, demand, and delay cases. Unknown values remain explicit.                                                                             |
| Evidence and contribution material | Reproducibility packet, independent-review protocol, source register, tutorials, notebook, scenario guidance, and contribution ideas.                                                                      |
| Local use                          | CLI and loopback dashboard. The browser demo runs its first result locally and has no shared simulation backend or client analytics.                                                                       |

Open the [guided experiment](https://khanlab.co.technology/), the [advanced workspace](https://khanlab.co.technology/?mode=advanced), the [50 MW outage case](https://khanlab.co.technology/?preset=ai_cluster_utility_loss), or the [course and study catalog](https://khanlab.co.technology/learn/). The [evidence hub](https://khanlab.co.technology/?mode=evidence) and [tutorial index](docs/tutorials/index.md) provide the supporting material. The [Python quickstart](docs/quickstart.md#run-with-uv) pins the published v2.0.1 wheel with its SHA-256 checksum. The current website and `main` can include later maintenance; the tagged release assets remain unchanged.

Current source and the browser demo also [reopen scenario JSON and electrical run exports](docs/engineering/energy-scenario-workspace.md#reopen-a-saved-experiment): validate inputs, preview changed assumptions, calculate a fresh result and compare it with Python. This workflow was included in `1.0.0` and is retained in `2.0.0`; earlier release assets remain unchanged.

The twelve continuity lessons also [export a printable worksheet](docs/tutorials/power-systems-course.md#print-a-lesson-worksheet) with a submitted prediction, completed inputs, worked calculation, graph and reproducibility record. The standalone HTML keeps the prediction and answer on separate printed pages. The `2.0.0` release retains this legacy worksheet workflow; infrastructure screens use their separate report format.

The advanced workspace also includes a [visual demand timeline](docs/engineering/energy-scenario-workspace.md#compose-a-demand-timeline): add, select, move and remove explicit load steps, preview requested energy, then run the schedule through the existing engine. Failures and recovery events are preserved. The `2.0.0` release retains the editor and the equal-energy timing tutorial; historical release assets remain unchanged.

## Next product decisions

Use reproducible first-run problems and learner feedback to prioritize the next capability. The guide, course, timeline editor and exports are available for evaluation; their delivery does not establish teaching effectiveness or independent use. Prioritize further changes using concrete reproduction or usability feedback.

## Release evidence and external review

The v2.0.0 software milestone retains the guide, continuity course, eighteen presets, reports, scenario imports and visual demand editor, and adds Infrastructure Engineering while preserving the later EMT/dynamics models. Release artifacts must pass the exact-source Python, browser, installed-package and hash checks described in [release readiness](docs/engineering/release-readiness.md). The v1.0.0 milestone and historical candidate assets remain unchanged.

Independent external reproduction remains an open evidence goal. Use the existing [review discussion](https://github.com/mohammadrezwankhan/datacenter-twin-lab/discussions/5) and [protocol](docs/validation/review-protocol.md), preserve reviewer attribution and scope, and resolve any reproduced mismatch. Maintainer or agent QA cannot satisfy that goal. Software versioning does not imply facility validation.

Calibrated facility examples are conditional on data rights, measurement provenance, uncertainty, a named validation owner, and an agreed acceptance boundary. None is included today. A DOI or archive citation is conditional on a stable artifact, approved deposit metadata, and an authorized archive account; no DOI or archive endorsement is available to cite now.

## Deferred boundaries

The existing isometric workspace and course scenes are teaching views of completed synthetic calculations. No broader 3D scene system or operational controller is promised. Live telemetry, shared multi-user service, cooling/workload prediction, calibrated alarms, protection studies, physical controls, and reliability or certification claims need separate contracts, evidence, security, and acceptance decisions; they are outside this release.

The loopback API remains local. There is no shared deployment, database, login, tenant isolation, persistent audit, facility telemetry, FAT/SAT, or real-time control. Do not use synthetic results as equipment selection, grid-adequacy, facility-safety, legal-compliance, uptime, or service-level evidence.

Outside adoption and repeat demo use remain unknown without voluntary, sourced reports. A 5,000-star aspiration has no validated timeline and is not evidence of accuracy, award readiness, or adoption. Maintainer delivery and CI do not count as outside review or endorsement.

Original code and synthetic fixtures use [Apache-2.0](LICENSE); see [NOTICE](NOTICE) and [browser runtime licenses](docs/third-party/README.md).

## Rolling plan: 19 November 2026 to 18 November 2027

This evidence-based plan supplements the preserved release history and current-capability sections above. It is grounded in source `d8dc3773830a397409a7a9c00a6ffed33c46fb4b` and the [dated verification ledger](docs/maintainer/VERIFICATION_EVIDENCE_LEDGER.md). Every item below is **PROPOSED**: dates, roles, person-day effort and staffing availability are planning assumptions, not delivered features or release commitments. This documentation run implements none of the proposed application/model changes.

The twelve-calendar-month interval begins **2026-11-19** and ends **2027-11-18**. Now/Next/Later/Horizon use three-month windows; they are not mislabeled calendar quarters. Calendar overlap is: partial Q4 2026 (**Nov 19–Dec 31**), full Q1/Q2/Q3 2027, and partial Q4 2027 (**Oct 1–Nov 18**).

| Phase | Proposed window | Main outcome |
| --- | --- | --- |
| Now | 2026-11-19–2027-02-18 | Traceable documentation delivery, locked reproduction, interface decision and publisher recovery |
| Next | 2027-02-19–2027-05-18 | Outside reproduction, explicit raw-input contract, observed learning journeys and discovery integrity |
| Later | 2027-05-19–2027-08-18 | Reproducible distribution, bounded dependency maintenance, successor rehearsal and domain review |
| Horizon | 2027-08-19–2027-11-18 | Conditional measured-use/archive decisions and a new plan based on actual evidence |

### Critical sequencing and shared work

DC-N02 supplies the clean-environment basis for DC-X01/X02/X03 and DC-L01/L02. DC-N04 precedes the independent recovery rehearsal DC-L03. External software reproduction and infrastructure review are separate evidence goals. Conditional model work DC-H03 follows the usability/domain/data decisions; it must not assume those decisions are positive. There is no confirmed runtime dependency on another repository. A portfolio coordinator may reuse review/tooling methods without inventing a cross-repository integration or copying unrelated findings into this public plan.

### Now — 2026-11-19 to 2027-02-18

#### DC-N01 — Close the documentation delivery evidence

**Class:** documentation. **Priority:** P0. **Suggested owner:** Documentation maintainer and authorized integration owner. **Effort:** 1–3 person-days. **Confidence:** high. **Proposed checkpoint:** 2026-11-30. **Dependencies:** none.

**Evidence:** [.github/workflows/tests.yml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/tests.yml); [docs/cloudflare-pages-deployment.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/cloudflare-pages-deployment.md); [AGENTS.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/AGENTS.md).

**Outcome:** Readers can identify exactly which documentation was reviewed and published.

**Proposed change:** Independently review the frozen package, refresh effective PR policy/checks and bind any actual merge/Pages publication to its content.

**Acceptance:**

- All 24 output dispositions and complete tree/interface accounting accepted by independent QA.
- Current required checks/reviews resolve for the actual candidate; no guard bypass.
- Record merged/deployed identities and distinctive handbook content, or retain a precise blocked/unverified outcome.

**Verification:** Independent frozen-candidate review; exact diff/tree; provider records and direct inspection of the existing published reference route.

**Risks / unresolved assumptions:** Effective protection metadata may remain inaccessible. Custom-domain Direct Upload is distinct from the configured docs-copy route.

#### DC-N02 — Reproduce the locked acceptance environment

**Class:** maintenance. **Priority:** P0. **Suggested owner:** Test/toolchain maintainer. **Effort:** 2–4 person-days. **Confidence:** high. **Proposed checkpoint:** 2026-12-18. **Dependencies:** none.

**Evidence:** [scripts/check_dependency_versions.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/check_dependency_versions.py); [requirements-api.lock](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/requirements-api.lock); [requirements-studies.lock](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/requirements-studies.lock); [apps/web/package-lock.json](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/package-lock.json); [.github/workflows/tests.yml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/tests.yml).

**Outcome:** A clean environment can repeat the intended source checks without conflating optional skips with passes.

**Proposed change:** Reconstruct declared Python/frontend dependencies and retain a source-bound environment receipt alongside full appropriate checks.

**Acceptance:**

- Offline and installed dependency checks pass against unchanged declarations.
- Run the applicable Python/API/scientific, complete native, type/build and browser gates with original skipped/unavailable records retained.
- Document actual OS/Python/Node/browser versions and source identity, including any capability-specific skips.

**Verification:** Clean checkout, exact lock install, original commands and raw provider/local logs with hashes.

**Risks / unresolved assumptions:** Package/runtime downloads and browser capabilities must be available. Successful author runs on differing NumPy/SciPy versions do not meet this acceptance criterion.

#### DC-N03 — Resolve the release-gate wrapper inconsistency

**Class:** defect/contract decision. **Priority:** P1. **Suggested owner:** TypeScript contract maintainer and domain reviewer. **Effort:** 2–4 person-days. **Confidence:** high. **Proposed checkpoint:** 2027-01-22. **Dependencies:** none.

**Evidence:** [apps/web/src/infrastructure/screens.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/infrastructure/screens.ts); [apps/web/src/infrastructure/InfrastructureCourse.tsx](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/infrastructure/InfrastructureCourse.tsx); [apps/web/tests-engine/infrastructure.test.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/tests-engine/infrastructure.test.ts).

**Outcome:** Callers can clearly distinguish numeric lesson results from six-state review decisions.

**Proposed change:** Choose a separate typed state-result envelope or an explicitly supported direct-only API; implement only the accepted contract in a separate source change.

**Acceptance:**

- A valid six-state direct call remains teaching-screens-satisfied with certification=false.
- A chosen wrapper contract handles valid state inputs or deliberately rejects them with documented interface typing.
- All numeric lesson outputs/hashes remain stable; malformed, unknown and mixed state inputs have focused negative tests.

**Verification:** First preserve the observed failing wrapper case; then run focused interface tests and the existing infrastructure/native suite.

**Risks / unresolved assumptions:** This is not a demonstrated failure of any current lesson. A broad union type could weaken numeric-input guards if adopted carelessly.

#### DC-N04 — Make custom-domain publishing recoverable

**Class:** maintenance. **Priority:** P1. **Suggested owner:** Repository owner and publication maintainer. **Effort:** 2–5 person-days. **Confidence:** medium. **Proposed checkpoint:** 2027-02-12. **Dependencies:** none.

**Evidence:** [docs/cloudflare-pages-deployment.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/cloudflare-pages-deployment.md); [apps/web/vite.config.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/vite.config.ts); [apps/web/site.config.json](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/site.config.json).

**Outcome:** An authorized successor can identify and reproduce the real publisher without searching for an undocumented workstation script.

**Proposed change:** Inventory the out-of-tree publisher/version and secure configuration, then decide which public-safe build/deployment instructions can be versioned.

**Acceptance:**

- Identify the actual authorized publisher artifact and exact version/hash.
- Document public asset selection, build/source identity and Worker route dependencies.
- Rehearse a dry build/artifact comparison without publishing or exposing credentials.

**Verification:** Owner-confirmed inventory plus an independently prepared build and byte-level artifact comparison.

**Risks / unresolved assumptions:** External script/access may be unavailable. Do not replace hosting/DNS or infer credentials to satisfy the plan.

### Next — 2027-02-19 to 2027-05-18

#### DC-X01 — Obtain a scoped outside reproduction

**Class:** verification. **Priority:** P1. **Suggested owner:** Independent external reviewer with maintainer support. **Effort:** 3–8 person-days. **Confidence:** medium-low. **Proposed checkpoint:** 2027-03-31. **Dependencies:** DC-N02.

**Evidence:** [docs/validation/review-protocol.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/validation/review-protocol.md); [docs/validation/reviewer-receipt-template.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/validation/reviewer-receipt-template.md); [docs/validation/evidence-method.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/validation/evidence-method.md).

**Outcome:** The project gains attributable evidence beyond its own maintainers and agents.

**Proposed change:** Use the existing protocol for a fresh environment and selected canonical cases, preserving reviewer scope and disagreements.

**Acceptance:**

- Reviewer supplies actual environment, exact source and independent expected/observed values.
- At least the 100/50 kWh charging-disabled cases and path-capacity case are reproduced or discrepancies are reported.
- Publish only an authorized receipt; status remains not obtained until the real review is complete.

**Verification:** External signed/attributed report evaluated against the existing review protocol, with raw numerical evidence where permitted.

**Risks / unresolved assumptions:** Reviewer availability and permission to publish are unknown. Software reproduction does not establish facility validity.

#### DC-X02 — Decide the raw JSON acceptance contract

**Class:** engineering improvement. **Priority:** P1. **Suggested owner:** API/native-engine maintainer. **Effort:** 2–5 person-days. **Confidence:** medium. **Proposed checkpoint:** 2027-04-16. **Dependencies:** DC-N02.

**Evidence:** [datacenter_twin/contracts.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/contracts.py); [apps/web/src/javascript-worker.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/javascript-worker.ts); [apps/web/src/ScenarioFiles.tsx](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/ScenarioFiles.tsx); [apps/web/src/worker-envelope.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/worker-envelope.ts).

**Outcome:** Users get explicit and testable behavior for ambiguous or oversized imported JSON.

**Proposed change:** Decide whether duplicate-key handling should be aligned across raw entry paths and document file-read versus request-body limits.

**Acceptance:**

- A decision lists each Python, worker and file-import boundary and intended duplicate-key/size behavior.
- If behavior changes, focused positive/negative cases prove it without weakening exact field/number validation.
- Existing valid 18-preset and bounded edge-case native/Python results stay unchanged.

**Verification:** Source-located contract decision plus byte-level raw JSON fixtures, native/Python comparisons and targeted import journeys.

**Risks / unresolved assumptions:** A parser replacement can change numeric normalization or add unjustified dependencies. The current difference is documented; no universal parity claim is assumed.

#### DC-X03 — Verify the completed-result learning journeys

**Class:** engineering improvement. **Priority:** P2. **Suggested owner:** Frontend maintainer and accessibility reviewer. **Effort:** 3–7 person-days. **Confidence:** medium. **Proposed checkpoint:** 2027-04-30. **Dependencies:** DC-N02.

**Evidence:** [apps/web/src/GuidedStart.tsx](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/GuidedStart.tsx); [apps/web/src/ScenarioFiles.tsx](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/ScenarioFiles.tsx); [apps/web/src/RunTools.tsx](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/RunTools.tsx); [apps/web/src/emt/Study.tsx](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/emt/Study.tsx); [apps/web/src/research/Studio.tsx](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/research/Studio.tsx).

**Outcome:** Learners can distinguish their draft/prediction from the calculation they export.

**Proposed change:** Collect bounded, authorized usability observations and run keyboard/reflow journeys across guide, import, reports, EMT and research.

**Acceptance:**

- Record browser/version/viewport for at least desktop and narrow-screen journeys.
- Verify explicit run, dirty draft, stale response, cancellation, export context and keyboard focus in the selected flows.
- Any reproduced defect gets a focused test and a separate scoped fix; no invented adoption or learning-effectiveness claim.

**Verification:** Existing Playwright journeys plus a named manual interaction protocol and evidence captures.

**Risks / unresolved assumptions:** Volunteer observations and device coverage may be limited. Session review progress is not durable learner tracking; no analytics system is implied.

#### DC-X04 — Protect discovery summaries as the catalog grows

**Class:** documentation. **Priority:** P2. **Suggested owner:** Documentation/discovery maintainer. **Effort:** 1–3 person-days. **Confidence:** high. **Proposed checkpoint:** 2027-05-14. **Dependencies:** none.

**Evidence:** [apps/web/seo.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/seo.ts); [apps/web/learn-manifest.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/learn-manifest.ts); [apps/web/learn-discovery.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/learn-discovery.ts); [apps/web/tests-engine/seo-delivery.test.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/tests-engine/seo-delivery.test.ts).

**Outcome:** Search/discovery material remains complete enough to find the real lessons while retaining their limits.

**Proposed change:** Evaluate the deliberate 60 KiB llms-full summary shortcut with actual catalog size and preserve source links/HOLD.

**Acceptance:**

- Every declared learning item has a valid reading/runtime mapping.
- The byte budget is measured and engineering HOLD remains in infrastructure summaries.
- Retain full prose at canonical routes; alter summary selection only if a measured failure requires it.

**Verification:** Locked build, source-hash manifest checks, complete SEO delivery tests and measured output bytes.

**Risks / unresolved assumptions:** Budget pressure may grow with future content. The summary is not represented as the full source manuscript.

### Later — 2027-05-19 to 2027-08-18

#### DC-L01 — Rehearse a source-bound distribution capsule

**Class:** maintenance. **Priority:** P1. **Suggested owner:** Packaging and verification maintainer. **Effort:** 3–6 person-days. **Confidence:** medium. **Proposed checkpoint:** 2027-06-18. **Dependencies:** DC-N02, DC-X01.

**Evidence:** [scripts/verify_distribution.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/verify_distribution.py); [scripts/build_evidence.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/build_evidence.py); [docs/engineering/release-readiness.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/engineering/release-readiness.md); [.github/workflows/publish-pypi.yml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/publish-pypi.yml).

**Outcome:** A successor can inspect a built distribution and its calculation evidence without relying on a moving branch.

**Proposed change:** Prepare a reproducible wheel/evidence capsule from a deliberately selected source, without modifying historical assets or publishing a release automatically.

**Acceptance:**

- Wheel metadata, included dashboard requirement where applicable and distribution verifier all agree.
- Retain source, wheel SHA-256 and fresh packet digest; reproduce the installed CLI path.
- Any actual later publication uses separately authorized existing release controls.

**Verification:** Clean package build/install, verify_distribution, exact-source CI and fresh evidence reproduction.

**Risks / unresolved assumptions:** Packaging/build dependencies and platform differences can affect artifacts. A capsule is not a new release until a real release decision occurs.

#### DC-L02 — Exercise one bounded dependency refresh

**Class:** maintenance. **Priority:** P1. **Suggested owner:** Toolchain and scientific maintainers. **Effort:** 4–8 person-days. **Confidence:** medium. **Proposed checkpoint:** 2027-07-16. **Dependencies:** DC-N02.

**Evidence:** [pyproject.toml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/pyproject.toml); [requirements-studies.lock](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/requirements-studies.lock); [apps/web/package.json](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/package.json); [datacenter_twin/research/sdcib.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/sdcib.py); [scripts/fetch_study_runtime.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/fetch_study_runtime.py).

**Outcome:** Dependency maintenance preserves numerical and browser contracts instead of relying on import success alone.

**Proposed change:** Select a justified update, revise relevant manifests/locks together and test the declared platform/scientific/browser matrix.

**Acceptance:**

- Offline and installed-version checks agree after the selected update.
- Numerical residual/refinement, raw contract, native/browser, packaging and security gates retain their documented meaning.
- Scientific wheel identity and internal typing/import compatibility are verified; no tolerance is relaxed to hide a regression.

**Verification:** Before/after source-bound CI and numerical comparison receipts, plus exact lock diff review.

**Risks / unresolved assumptions:** Updated solver/toolchain behavior may reveal real incompatibilities. This plan does not prescribe an unverified future version.

#### DC-L03 — Run an owner-handoff recovery rehearsal

**Class:** maintenance. **Priority:** P1. **Suggested owner:** Successor maintainer with owner oversight. **Effort:** 2–5 person-days. **Confidence:** medium. **Proposed checkpoint:** 2027-08-06. **Dependencies:** DC-N04, DC-L01.

**Evidence:** [docs/cloudflare-pages-deployment.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/cloudflare-pages-deployment.md); [AGENTS.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/AGENTS.md); [docs/engineering/browser-demo.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/engineering/browser-demo.md).

**Outcome:** Recovery depends on inspectable artifacts and explicit authority rather than one workstation.

**Proposed change:** Have a different authorized maintainer follow the recovery runbook through source, local app, evidence, docs and publisher dry-build stages.

**Acceptance:**

- The successor records exact starting source, environment and missing capabilities.
- Rebuild and verify the handbook/evidence without rewriting old packets.
- Record any inaccessible policy/publisher boundary accurately; no credentials are copied into public materials.

**Verification:** Independent rehearsal receipt and artifact comparison; any live publication remains a separately authorized step.

**Risks / unresolved assumptions:** Account or environment ownership can require owner intervention. A dry rehearsal does not prove a live deployment occurred.

#### DC-L04 — Review infrastructure derivations and labels externally

**Class:** verification. **Priority:** P2. **Suggested owner:** Independent domain reviewer and content maintainer. **Effort:** 5–12 person-days. **Confidence:** medium-low. **Proposed checkpoint:** 2027-08-18. **Dependencies:** DC-X01.

**Evidence:** [apps/web/src/infrastructure/screens.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/infrastructure/screens.ts); [data/infrastructure/golden-cases.json](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/data/infrastructure/golden-cases.json); [docs/releases/v2.0.0-publication-decision.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/releases/v2.0.0-publication-decision.md); [NOTICE](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/NOTICE).

**Outcome:** The teaching material gains an attributable review of equation boundaries, unit conversions and source labels.

**Proposed change:** Review the eleven lesson model families and selected edge cases while keeping rights and Engineering HOLD explicit.

**Acceptance:**

- Each reviewed family identifies implemented equation, units, assumption/source label and a hand-checkable case.
- Resolve or retain discrepancies with source locators and reviewed limits.
- The report does not lift Engineering HOLD, grant new rights or claim equipment validation by implication.

**Verification:** Attributable domain review, independent arithmetic and comparison with existing 24-case/222-value verifier.

**Risks / unresolved assumptions:** Reviewer expertise and licensed source access are not assumed. A scalar review is narrower than full facility engineering.

### Horizon — 2027-08-19 to 2027-11-18

#### DC-H01 — Decide whether a measured-use study is feasible

**Class:** exploratory research. **Priority:** P3. **Suggested owner:** Data-rights owner and validation lead. **Effort:** 6–15 person-days. **Confidence:** low. **Proposed checkpoint:** 2027-09-30. **Dependencies:** DC-X01, DC-L04.

**Evidence:** [datacenter_twin/research/grid_network.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/grid_network.py); [docs/validation/review-protocol.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/validation/review-protocol.md); [NOTICE](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/NOTICE).

**Outcome:** Any future measured-use effort begins with a valid evidence contract.

**Proposed change:** Evaluate available authorized data/originals, unit bases, uncertainty and an agreed use boundary before proposing calibration or domain expansion.

**Acceptance:**

- Explicit go/no-go record identifies data permission, provenance, units/bases and validation ownership.
- A proposed uncertainty/error budget and held-out comparison protocol are reviewable.
- If inputs remain unavailable, retain the no-go and current synthetic/adapted limits; do not manufacture a trace.

**Verification:** Rights/provenance review and an independently reviewed validation design, not a fabricated model-accuracy metric.

**Risks / unresolved assumptions:** Original MATLAB and measured GPU trace are currently absent. Permission, representative data and validation effort may be unavailable.

#### DC-H02 — Evaluate an archival citation deposit

**Class:** documentation. **Priority:** P3. **Suggested owner:** Repository owner and release maintainer. **Effort:** 2–5 person-days. **Confidence:** medium-low. **Proposed checkpoint:** 2027-10-15. **Dependencies:** DC-L01.

**Evidence:** [CITATION.cff](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/CITATION.cff); [docs/engineering/release-readiness.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/engineering/release-readiness.md); [NOTICE](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/NOTICE).

**Outcome:** A stable artifact could receive a verifiable archival citation if an authorized route exists.

**Proposed change:** Review artifact identity, metadata and account authority; decide whether a deposit is justified.

**Acceptance:**

- Verify the actual artifact/version, author metadata, rights and authorized archive account.
- If a deposit occurs under separate authorization, record the real returned identifier and resolvable record.
- Otherwise keep CFF without an invented DOI and record the decision.

**Verification:** Archive provider record plus artifact checksum/metadata reconciliation; no speculative identifier.

**Risks / unresolved assumptions:** Archive access/permission and a suitable stable artifact are conditional. A repository version number is not an archive endorsement.

#### DC-H03 — Select one evidence-supported model improvement

**Class:** exploratory research. **Priority:** P3. **Suggested owner:** Scientific maintainer with independent reviewer. **Effort:** 8–20 person-days. **Confidence:** low. **Proposed checkpoint:** 2027-10-29. **Dependencies:** DC-X03, DC-L04, DC-H01.

**Evidence:** [datacenter_twin/research/__init__.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/research/__init__.py); [tests/test_research.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/tests/test_research.py); [apps/web/src/infrastructure/screens.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/infrastructure/screens.ts).

**Outcome:** Future model work addresses a demonstrated learning or numerical need.

**Proposed change:** Choose at most one bounded extension or correction from reviewed findings; define equations, accepted domain and verification before implementation.

**Acceptance:**

- Decision cites a reproduced need rather than a popularity target.
- Proposed change has explicit units, signs, initial/boundary conditions, failure behavior and independent acceptance cases.
- No existing synthetic result is relabelled calibrated; a no-go is acceptable when evidence is insufficient.

**Verification:** Reviewed design and independent verification plan; any later implementation requires its own source/test review.

**Risks / unresolved assumptions:** Feasibility depends on prior review/data decisions. Changing the scientific domain can invalidate existing evidence.

#### DC-H04 — Close the year and roll the evidence plan forward

**Class:** documentation. **Priority:** P2. **Suggested owner:** Repository owner and documentation maintainer. **Effort:** 1–3 person-days. **Confidence:** high. **Proposed checkpoint:** 2027-11-18. **Dependencies:** DC-N01, DC-X01, DC-L03.

**Evidence:** [ROADMAP.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/ROADMAP.md); [docs/validation/review-protocol.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/validation/review-protocol.md); [.github/workflows/tests.yml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/tests.yml).

**Outcome:** The next plan begins from actual delivered/reviewed outcomes.

**Proposed change:** Reconcile stable roadmap IDs with receipts, open limitations, publication identity and voluntary user feedback.

**Acceptance:**

- Every item is completed with evidence, explicitly deferred, blocked or rejected; no item silently disappears.
- Record independent-review and recovery outcomes separately from code delivery and publication.
- Publish the next rolling 12-calendar-month proposal with partial-quarter boundaries and no invented adoption/star timeline.

**Verification:** Owner review of the evidence/roadmap register and exact source/publication snapshots.

**Risks / unresolved assumptions:** Some conditional items may remain no-go or blocked. Absence of analytics is not evidence of zero or positive adoption.

### Evidence required to close an item

Retain the stable ID, exact changed source/artifact, actual execution or review date, acceptance result and unresolved limits. A proposal becomes complete through its acceptance evidence, not by moving its calendar label. Preserve no-go, deferred and blocked outcomes. None of these milestones promises facility calibration, new hosting, a new release, a DOI, certification or a star/adoption target.
