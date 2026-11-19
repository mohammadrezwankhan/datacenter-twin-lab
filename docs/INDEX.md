# Documentation index

This reference package connects the repository's established tutorials and contracts to the implementation reviewed at **`d8dc3773830a397409a7a9c00a6ffed33c46fb4b`**, dated **19 November 2026**. The software remains version 2.0.1; new documentation does not announce a new release.

**[Read the reference handbook](reference/index.html)** · [Project README](../README.md) · [Existing quickstart](quickstart.md) · [Canonical battery case](canonical-case.md) · [Offline four-module companion](index.html)

## Choose a question

- **Run a result:** [setup](developer/SETUP_AND_REPRODUCIBILITY.md), [worked labs](developer/WORKED_EXAMPLES_AND_LABS.md), [troubleshooting](developer/TROUBLESHOOTING.md).
- **Understand a number:** [equations](math-and-physics/EQUATIONS_AND_DERIVATIONS.md), [units/defaults](math-and-physics/PARAMETERS_AND_SYMBOLS.md), [limits](math-and-physics/ASSUMPTIONS_AND_LIMITS.md).
- **Change or integrate code:** [architecture](developer/ARCHITECTURE.md), [interfaces](developer/API_CLI_AND_INTERFACES.md), [contribution rules](../CONTRIBUTING.md).
- **Assess evidence or deliver docs:** [verification ledger](maintainer/VERIFICATION_EVIDENCE_LEDGER.md), [CI/publication](maintainer/CI_CD_AND_RELEASE_PLAYBOOK.md), [toolchain](maintainer/TOOLCHAIN_AND_DEPENDENCY_MATRIX.md).
- **Maintain or hand over ownership:** [debt](maintainer/FAILURE_MODES_AND_TECH_DEBT.md), [maintenance](maintainer/DOCS_MAINTENANCE_RUNBOOK.md), [recovery](owner/BUS_FACTOR_RECOVERY_RUNBOOK.md), [proposed roadmap](../ROADMAP.md#rolling-plan-19-november-2026-to-18-november-2027).

## Canonical output map

Each requested output has an actual canonical file. Existing CFF/security content is preserved and verified rather than replaced with generic policy text. Existing README, contribution guidance, changelog and roadmap history remain intact, with additive reference sections.

| Canonical document | Purpose |
| --- | --- |
| [README.md](../README.md) | Established project entry, preserved capability/history and added reference navigation |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Existing contribution rules plus source/evidence and handbook maintenance |
| [CHANGELOG.md](../CHANGELOG.md) | Historical releases preserved; clearly unreleased documentation entry |
| [CITATION.cff](../CITATION.cff) | Preserved known author, release 2.0.1/date and declared CFF 1.2.0 metadata |
| [SECURITY.md](../SECURITY.md) | Preserved local trust, file-output and private reporting boundaries |
| [ROADMAP.md](../ROADMAP.md) | Historical milestones plus traceable twelve-month proposed plan |
| [docs/INDEX.md](INDEX.md) | Canonical map across developer, science, maintainer and owner references |
| [docs/developer/ARCHITECTURE.md](developer/ARCHITECTURE.md) | Separate model/runtime routes and publication systems |
| [docs/developer/SETUP_AND_REPRODUCIBILITY.md](developer/SETUP_AND_REPRODUCIBILITY.md) | Source/locked setup, exact limits and documentation build |
| [docs/developer/API_CLI_AND_INTERFACES.md](developer/API_CLI_AND_INTERFACES.md) | CLI, nine business HTTP routes, library/worker/UI/data contracts |
| [docs/developer/WORKED_EXAMPLES_AND_LABS.md](developer/WORKED_EXAMPLES_AND_LABS.md) | Seven labs with independent arithmetic and observed scope |
| [docs/developer/TROUBLESHOOTING.md](developer/TROUBLESHOOTING.md) | Boundary-specific symptoms, causes and safe reproducible next steps |
| [docs/math-and-physics/EQUATIONS_AND_DERIVATIONS.md](math-and-physics/EQUATIONS_AND_DERIVATIONS.md) | Implemented equations, controls, state models, solvers and signs |
| [docs/math-and-physics/PARAMETERS_AND_SYMBOLS.md](math-and-physics/PARAMETERS_AND_SYMBOLS.md) | Fields, accepted domains, units and normalized-state glossary |
| [docs/math-and-physics/ASSUMPTIONS_AND_LIMITS.md](math-and-physics/ASSUMPTIONS_AND_LIMITS.md) | Scientific, interface, provenance and verification boundaries |
| [docs/maintainer/VERIFICATION_EVIDENCE_LEDGER.md](maintainer/VERIFICATION_EVIDENCE_LEDGER.md) | Dated source commands, digests, historical CI and unverified stages |
| [docs/maintainer/CI_CD_AND_RELEASE_PLAYBOOK.md](maintainer/CI_CD_AND_RELEASE_PLAYBOOK.md) | Seven workflows, current-policy checks and distinct publishing routes |
| [docs/maintainer/TOOLCHAIN_AND_DEPENDENCY_MATRIX.md](maintainer/TOOLCHAIN_AND_DEPENDENCY_MATRIX.md) | Declared pins versus available versions; update order and rights |
| [docs/maintainer/FAILURE_MODES_AND_TECH_DEBT.md](maintainer/FAILURE_MODES_AND_TECH_DEBT.md) | Source-specific findings, environment limits and mapped proposals |
| [docs/maintainer/DOCS_MAINTENANCE_RUNBOOK.md](maintainer/DOCS_MAINTENANCE_RUNBOOK.md) | Canonical docs, renderer, source preservation and independent review |
| [docs/owner/ADR/ADR-0000-INDEX.md](owner/ADR/ADR-0000-INDEX.md) | Observed source decisions separated from proposed new decisions |
| [docs/owner/GOVERNANCE_AND_SCOPE.md](owner/GOVERNANCE_AND_SCOPE.md) | Known ownership/rights and suggested responsibilities without invented approvals |
| [docs/owner/BUS_FACTOR_RECOVERY_RUNBOOK.md](owner/BUS_FACTOR_RECOVERY_RUNBOOK.md) | Recover source, toolchain, evidence, docs and missing publisher boundaries |
| [docs/owner/PORTFOLIO_INTEGRATION.md](owner/PORTFOLIO_INTEGRATION.md) | Public export/status/units contract without inferred repository dependencies |


## Existing guides retain their scopes

| Existing material | Continue using it for |
| --- | --- |
| [Scenario v1](contracts/scenario-v1.md), [electrical v2](contracts/electrical-v2.md), [local API](contracts/local-api.md), [reports](contracts/reports.md) | Canonical input/output and local trust contracts |
| [Canonical case](canonical-case.md), [evidence method](validation/evidence-method.md), [battery notebook](examples/battery-ride-through.ipynb) | Exact guided/base-preset distinctions and independent arithmetic |
| [Tutorial index](tutorials/index.md), [course notes](tutorials/power-systems-course.md), [scenario catalog](scenarios/index.md) | Existing learner progression and scenario explanations |
| [EMT study](studies/emt.md), [power dynamics](studies/power-dynamics.md) | Separate advanced numerical models and source provenance |
| [Release readiness](engineering/release-readiness.md), [v2.0.0 publication decision](releases/v2.0.0-publication-decision.md), [v2.0.1 receipt](releases/v2.0.1.md) | Historical release/rights decisions and Engineering HOLD |
| [External review protocol](validation/review-protocol.md), [reviewer template](validation/reviewer-receipt-template.md) | Attributable independent reproduction, still distinct from maintainer/agent QA |
| [Browser development](engineering/browser-demo.md), [dependency validation](engineering/dependency-validation.md), [native file reader](engineering/build-file-reader.md) | Existing build/runtime/platform gates |
| [Custom-domain deployment](cloudflare-pages-deployment.md), [native lesson catalog](native-lessons.html) | Their dated publication/source routes, not inferred current deployment |
| [Runtime notices](third-party/README.md), [NOTICE](../NOTICE), [LICENSE](../LICENSE) | Original and separately licensed material |

The current course has 24 lessons; adding one EMT and five dynamics learning items gives 30 discovery items. Eighteen presets and the four-module companion are separate catalogs. Use each model's equations and applied input identity; do not combine the companion's cooling proxy, infrastructure screens and native continuity results as though they were one coupled facility simulation. Source counts and verification limits are qualified in the new reference chapters.
