# Toolchain and dependency matrix

The **declared** column comes from source `d8dc3773830a397409a7a9c00a6ffed33c46fb4b`. The **observed** column describes the authoring environment on 19 November 2026. They are separate evidence classes. The audit did not update a manifest or lockfile to make them agree.

| Component | Declared / configured | Observed locally and implication |
| --- | --- | --- |
| Python core | Python ≥ 3.12; no required runtime dependencies | Python 3.12.14; isolated standard-library suite and CLI examples executed |
| Python CI matrix | 3.12/3.14, Ubuntu/Windows; macOS native-reader check | Historical exact-source CI recorded; not locally emulated |
| Build backend | setuptools 84.2.1 | No new wheel/build-backend reproduction claimed |
| FastAPI | 0.162.2 | 0.141.1; installed-version diagnostic failed |
| Uvicorn | 0.54.0 | 0.52.1; mismatch in preflight |
| HTTPX test client | 0.28.1 | 0.28.1; matching this one package is not a full locked environment |
| NumPy | 2.5.4 | 2.3.5; supplementary research/spectrum execution only |
| SciPy | 1.18.1 | 1.17.0; supplementary research execution only |
| Node | Root engine constraint `^22.13.0 \|\| >=24`; contributor/CI route Node 24 | 24.22.3; native stripping/test subset executed |
| npm | Lock-based `npm ci --ignore-scripts` | 11.9.0; no new frontend installation |
| React / React DOM | 19.3.1 / 19.3.1 | Full locked application build not run locally |
| Vite | 8.3.6 | Full locked production/demo build not run locally |
| TypeScript, app | 7.0.2 | Separate available parser 5.9.3 used for syntax inventory only; no compiler/typecheck claim |
| TypeScript, root quality tools | 6.0.3 | Distinct root tooling contract; not silently substituted for app compiler |
| ESLint, root | 10.14.0 | Config/source inspected; no full local quality installation |
| Pyodide | 314.0.7 | Full browser scientific runtime not staged in this run |
| Playwright | 1.65.0 | No fresh browser journey or visual claim |
| parse5 | 8.1.1 | Unavailable in the local test workspace; two dependent native test files excluded |
| CFF validation | Declared CFF 1.2.0 schema | PyYAML 6.0.3/jsonschema 4.26.0 available; `cffconvert` absent; direct schema validation is used |
| Reference handbook | Python standard library + Pandoc executable | Documentation-only renderer; separate from application dependencies |

Sources: [pyproject.toml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/pyproject.toml), [requirements-api.lock](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/requirements-api.lock), [requirements-studies.lock](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/requirements-studies.lock), [package.json](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/package.json), [apps/web/package.json](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/package.json), [.github/workflows/tests.yml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/tests.yml). Exact transitive versions remain in their lockfiles; the table does not replace them.

## Reproduction order

Run `scripts/check_dependency_versions.py --lock-only api test-api studies` before downloads. Install the corresponding locks, then run the installed-version check with the same interpreter selected by `TWIN_PYTHON`. Install frontend packages with the existing lock and scripts-disabled policy. Fetch hash-pinned study wheels before full browser preparation. Run the build, native comparisons and browser tests in their documented order. [Setup](../developer/SETUP_AND_REPRODUCIBILITY.md), [existing dependency workflow](../engineering/dependency-validation.md).

The runtime fetcher accepts HTTPS URLs without embedded credentials, bounds wheel size and verifies SHA-256 before caching. It retries selected transient transport failures, not integrity failures. Study Python archives are verified again at the browser boundary. A vendor package version, repository source version, compiled bundle and generated evidence version must not be inferred from one another. [scripts/fetch_study_runtime.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/fetch_study_runtime.py), [scripts/prepare_browser_demo.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/prepare_browser_demo.py), [apps/web/src/runtime-progress.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/src/runtime-progress.ts).

## Provenance and license handling

Keep Apache-2.0, NOTICE, CFF authorship and all separately licensed runtime/vendor files intact. Vendor sources and binary media are byte-accounted, with indexed-only dispositions where no semantic/visual review was performed. The existence of a vendored implementation is not a security audit or an executed compatibility test. [NOTICE](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/NOTICE), [docs/third-party/README.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/third-party/README.md), [apps/web/public/THIRD-PARTY-NOTICES.txt](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/public/THIRD-PARTY-NOTICES.txt).

## Updating dependencies later

Treat a dependency change as its own reviewed implementation task: update manifest and appropriate lock together; run offline and installed checks; retain Python/OS, native/browser parity, research residual/refinement, packaging and security evidence. Private SciPy import/type surfaces and browser scientific wheel compatibility need particular attention. A successful run on different installed versions is useful diagnostic evidence but cannot replace the declared acceptance environment. Proposed work is listed in [the roadmap](../../ROADMAP.md#rolling-plan-19-november-2026-to-18-november-2027).
