# POLYGLOT TWIN — multilingual readiness audit

Audit date: 2026-11-24. Frozen [source baseline](https://github.com/mohammadrezwankhan/datacenter-twin-lab/commit/72e34163544fd3282f7af95edbbed7a05667c105).

## Evidence and scope

The default branch was inspected at the baseline above. Its recursive tree was not truncated: 763 tracked files, no existing Chinese README or i18n directory. The open-PR query returned no open pull requests at that snapshot. The baseline check-runs API returned 21 completed successes: [Tests](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/45280601198), [Hardened CI](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/45280601250), [CodeQL](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/45280601242). These are not checks on this documentation candidate.

The audit used role-based source passes, not independent people or separately executed agents. The UI evidence is a representative inspection of major entry points, content, reports, formatting, build and responsive tests; it is not an exhaustive string count. No live network reachability test in mainland China or local application build was performed.

| Inventory | Source evidence |
| --- | --- |
| Python package, Python >=3.12, no core runtime dependencies, CLI entry | [pyproject.toml:5–36](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/pyproject.toml#L5-L36) |
| README and 24 lessons, 18 scenarios, 4 profiles, EMT and 5 dynamics studies | [README.md:137–153](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/README.md#L137-L153) |
| Distinct planning/native/JS/Python verification/EMT/research models | [Architecture:5–28](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/docs/developer/ARCHITECTURE.md#L5-L28) |
| Synthetic canonical lesson and independent arithmetic | [canonical-case.md:3–32](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/docs/canonical-case.md#L3-L32) |
| Source priority and shared failures | [continuity.py:291–387](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/datacenter_twin/continuity.py#L291-L387) |
| Reference A/B path graph | [reference-site-v2.json:20–39](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/datacenter_twin/resources/reference-site-v2.json#L20-L39) |
| Existing diagrams and screenshot assets | [README.md:13–48](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/README.md#L13-L48), [README.md:119–135](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/README.md#L119-L135) |
| Package-specific readme and historical release instructions | [README-PYPI.md:7–30](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/README-PYPI.md#L7-L30) |
| Existing source requirements and disclosure | [CONTRIBUTING.md:38–76](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/CONTRIBUTING.md#L38-L76) |
| Metadata and historical changelog | [CITATION.cff:1–22](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/CITATION.cff#L1-L22), [CHANGELOG.md:3–29](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/CHANGELOG.md#L3-L29) |
| Existing backup | [README.before-makeover-2026-11-08.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/README.before-makeover-2026-11-08.md) |

## Verbatim command ledger

These are source matches, not a new successful execution record. Follow the documented prerequisite and fixture setup before browser tests. Mirror URLs are optional configuration references, not new repository CLI commands.

| Command | Frozen source |
| --- | --- |
| `pip install datacenter-twin` | [README.md:77](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/README.md#L77) |
| `python -m pip install .` | [README.md:85](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/README.md#L85) |
| `python -m datacenter_twin simulate --preset generator_failure` | [README.md:86](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/README.md#L86) |
| `python -m unittest discover -s tests -v` | [README.md:87](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/README.md#L87) |
| `npm --prefix apps/web ci --ignore-scripts` | [CONTRIBUTING.md:44](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/CONTRIBUTING.md#L44) |
| `npm --prefix apps/web run build` | [CONTRIBUTING.md:45](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/CONTRIBUTING.md#L45) |
| `npm --prefix apps/web run test:engine` | [docs/engineering/browser-demo.md:57](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/docs/engineering/browser-demo.md#L57) |
| `npm --prefix apps/web run build:demo` | [docs/engineering/browser-demo.md:58](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/docs/engineering/browser-demo.md#L58) |
| `npm --prefix apps/web run test:demo` | [docs/engineering/browser-demo.md:60](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/docs/engineering/browser-demo.md#L60) |
| `python -m datacenter_twin serve` | [docs/quickstart.md:150](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/docs/quickstart.md#L150) |

## Prioritised remediation plan

| ID | Priority | File evidence | Minimal change and measurable acceptance |
| --- | --- | --- | --- |
| I18N-01 | P0 | [README.md:1–19](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/README.md#L1-L19) | Add reversible navigation outside the managed presentation markers; link a concise Chinese landing guide. |
| I18N-02 | P0 | [docs/scenarios/glossary.md:5–16](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/docs/scenarios/glossary.md#L5-L16) | Lock Chinese engineering terms; preserve SI units and model limits. |
| I18N-03 | P0 | [DOCS_MAINTENANCE_RUNBOOK.md:29–43](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/docs/maintainer/DOCS_MAINTENANCE_RUNBOOK.md#L29-L43) | Propose a separate docs-sync check: record reviewed source commit and hashes for translated sections, flag changed commands or claims, resolve relative links, enforce switchers and require translator receipt before updating markers. Never fake freshness by updating only the SHA. |
| I18N-04 | P0 | [json.ts:39–51](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/src/js-engine/json.ts#L39-L51), [canonical.ts:44–54](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/src/js-engine/canonical.ts#L44-L54) | Keep locale outside model inputs; assert byte-identical canonical results and unchanged input hashes, IDs, precision and duplicate-key handling. |
| I18N-05 | P1 | [GuidedStart.tsx:256–348](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/src/GuidedStart.tsx#L256-L348) | Extract user-visible labels, errors and ARIA text into typed en/zh-CN dictionaries; test key parity. |
| I18N-06 | P1 | [App.tsx:336–356](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/src/App.tsx#L336-L356) | Extract topology labels and interpolated accessible names. |
| I18N-07 | P1 | [RunTools.tsx:114–127](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/src/RunTools.tsx#L114-L127), [321–325](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/src/RunTools.tsx#L321-L325) | Extract report controls and errors; do not translate CSV schema fields. |
| I18N-08 | P1 | [GuidedStart.tsx:19–32](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/src/GuidedStart.tsx#L19-L32), [emt/format.ts:1–21](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/src/emt/format.ts#L1-L21), [client.ts:5](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/src/client.ts#L5) | Use a locale-keyed display formatter; keep decimal strings exact, avoid converting high-precision scientific values to binary floats for exports, keep units and signs. |
| I18N-09 | P1 | [styles.css:486](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/src/styles.css#L486), [guided-start.css:251](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/src/guided-start.css#L251) | Propose local CJK font fallbacks (PingFang SC, Microsoft YaHei, Noto Sans CJK SC, system fallback) without remote fonts or CSP changes. |
| I18N-10 | P1 | [energy-workspace.css:222–549](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/src/energy-workspace.css#L222-L549) | Review nowrap controls, SVG labels, tooltips and tables. Extend existing 320px/200% text tests and full viewport matrix; test both locales at 360, 390, 768, 1024, 1440 and 1920 px. |
| I18N-11 | P1 | [course-catalog.json:1–24](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/src/course-catalog.json#L1-L24) | Separate stable lesson IDs/routes from translated titles. Keep existing course-registry check. |
| I18N-12 | P1 | [13-evidence-load-ledger.json:11–23](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/src/infrastructure/content/13-evidence-load-ledger.json#L11-L23) | Translate educational prose in presentation records; retain values, evidence/source IDs and canonical content identities. |
| I18N-13 | P1 | [contracts.py:13–35](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/datacenter_twin/contracts.py#L13-L35), [reporting.py:178–298](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/datacenter_twin/reporting.py#L178-L298), [js-engine/report.ts:236–343](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/src/js-engine/report.ts#L236-L343) | Design diagnostic IDs and localised human reports separately; preserve default English output and all existing schema/hash contracts; localise HTML lang only when a translated report exists. |
| I18N-14 | P2 | [index.html:2–54](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/index.html#L2-L54), [seo.ts:118–151](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/apps/web/seo.ts#L118-L151) | For GitHub discovery add Chinese technical keywords in README prose and maintain English navigation. Propose real translated static URLs, self-canonical, reciprocal hreflang and accurate inLanguage only after those pages exist; validate root/subpath/sitemap routes and no-JS reading. |
| I18N-15 | P2 | [README.before-makeover-2026-11-08.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/README.before-makeover-2026-11-08.md) | Recommend separate cleanup after checking all references, owner and history; do not delete in this PR. |
| I18N-16 | P2 | [CITATION.cff:8–9](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/CITATION.cff#L8-L9), [README.md:73–74](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/72e34163544fd3282f7af95edbbed7a05667c105/README.md#L73-L74) | Check intended citation and distribution versions against published artifacts; do not mechanically rewrite historical metadata. |

## Minimal-diff delivery sequence

1. Documentation candidate: only two READMEs, glossary and audit. English README bytes after the inserted switcher are unchanged. No source, dependency, lock, fixture, workflow or deployment edits.
2. Foundation: propose new typed locale modules under apps/web/src/i18n with en and zh-CN message keys, explicit locale validation, English fallback and accessible language switcher. Start with GuidedStart; default English journeys stay unchanged.
3. Interface: extend to App, RunTools, chart/scene labels, runtime/error messages and course content. Use a locale-aware display adapter; machine-readable JSON/CSV, units, identifiers, canonical data and engine parity remain stable.
4. Layout: test local CJK fallback, text zoom, line wrapping, keyboard controls, screen-reader accessible names and responsive viewports. Reuse mobile-text-layout.spec.ts and viewport-matrix.audit.spec.ts without removing existing coverage.
5. SEO: localise static build metadata and actual translated pages, not fictional routes. Verify canonical and hreflang reciprocity, no-JS delivery, sitemap and evidence links; check deployed artifact separately.
6. Add docs-sync and Mermaid validation to a compatible existing CI job after reviewing pinned tooling. Preserve existing check names, events, lock validation, security settings, and scientific tolerances.

## CI and verification ledger

The seven workflow files were inspected: tests.yml, hardened-ci.yml, codeql.yml, qa-audit.yml, deploy-dashboard.yml, portfolio-dashboard-check.yml and publish-pypi.yml. Tests, Hardened CI and QA Audit run on PRs. The Flagship workflow validates on matching main pushes and manual dispatch; its deploy job is disabled and Pages uses a separate publisher. PyPI publication is manual. Existing scopes must not be weakened.

The root and web Prettier configurations were inspected. Current scripts target named JS/TS/JSON/HTML surfaces, not a dedicated Markdown check. Existing local pre-commit security hooks call the repository security runner; the existing Gitleaks policy extends defaults with narrowly reviewed exceptions. No bypass or policy changes are proposed.

| Gate | Candidate state before remote CI |
| --- | --- |
| G1 commands | Source-line equality checked for every README shell command; all links and claims require final review. |
| G2 switchers | Static link and unchanged-English-body checks performed; candidate GitHub rendering pending. |
| G3 Mermaid | Quoted labels, balanced fences and source-mapped topology; actual parser and light/dark rendering pending. |
| G4 glossary | 15 locked bilingual terms, same table terms in Chinese README; native technical review pending. |
| G5 roadmap | File-referenced actions delivered; docs-sync implementation is a follow-up, not an existing CI feature. |

## Draft follow-up verification

A separate coding-agent language review refined the Chinese terms for modeled path capacity, elapsed battery depletion time, and PUE. A separate technical review checked both diagrams against source and confirmed the canonical calculations. The follow-up checked six commands against the frozen source lines, 33 local links, 53 pinned file references, and all 15 glossary pairs. Both diagrams rendered in standalone Mermaid 12.3.0 in installed Chrome in light and dark themes. These are documentation checks, not human native-speaker sign-off or a test of GitHub's exact renderer.

On Windows with Python 3.12, the full unittest suite ran 307 tests with 56 skips and no failures. The generator-failure CLI preset still reported simulated depletion at 607.8 seconds. Final candidate and post-merge checks belong to their exact GitHub revisions. This audit does not authorise an application deployment or change Engineering HOLD.

[Chinese README](../../README.zh-CN.md) · [Bilingual glossary](GLOSSARY.zh-CN.md)
