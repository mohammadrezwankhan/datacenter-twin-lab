# Setup and reproducibility

Use a new checkout and isolated environment. The commands below are rooted at the directory containing `pyproject.toml`. For the published wheel and its recorded SHA-256, retain the existing [quickstart](../quickstart.md); the source procedure here reproduces the inspected commit, not an unspecified moving branch.

```sh
git clone https://github.com/mohammadrezwankhan/datacenter-twin-lab.git
cd datacenter-twin-lab
git checkout d8dc3773830a397409a7a9c00a6ffed33c46fb4b
git rev-parse HEAD
python3 -m venv .venv
.venv/bin/python -m datacenter_twin simulate --preset generator_failure
```

The last command works from the source root without installing optional dependencies. Python **3.12+** is declared; current source CI targets 3.12 and 3.14 on Linux/Windows and includes a macOS native-reader check. These targets are not a claim that every possible interpreter/platform combination was executed locally. [pyproject.toml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/pyproject.toml), [.github/workflows/tests.yml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/tests.yml).

## Dependency-free core

```sh
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python -m datacenter_twin run data/scenarios/baseline-1mw.json
.venv/bin/python -m datacenter_twin simulate --preset generator_failure --format markdown
.venv/bin/python -m datacenter_twin.emt --preset voltage-sag
```

On 19 November 2026 the isolated standard-library run discovered **306 tests**, executed **247 successfully**, and explicitly skipped **59** requiring optional API/scientific packages. An `OK (skipped=59)` summary is not 306 executed passes. The [verification ledger](../maintainer/VERIFICATION_EVIDENCE_LEDGER.md) records this run separately from later scientific checks. Use the test modules linked in that ledger for the precise scope.

## Locked API and scientific environment

Check the manifests before any dependency download, then install the corresponding locks and verify installed versions with the same interpreter:

```sh
.venv/bin/python scripts/check_dependency_versions.py --lock-only api test-api studies
.venv/bin/python -m pip install -r requirements-api.lock
.venv/bin/python -m pip install -r requirements-studies.lock
.venv/bin/python scripts/check_dependency_versions.py api test-api studies
export TWIN_PYTHON="$PWD/.venv/bin/python"
.venv/bin/python -m unittest discover -s tests -v
```

The offline check compares lock contents to declared extras. The installed check inspects distributions and fails on the first mismatch; do not silently replace exact pins with whichever versions are preinstalled. The audit environment failed this check at FastAPI `0.141.1` versus declared `0.162.2`. Its later NumPy/SciPy executions are supplementary observations, not a reproduction of the locked CI environment. [scripts/check_dependency_versions.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/check_dependency_versions.py), [requirements-api.lock](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/requirements-api.lock), [requirements-studies.lock](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/requirements-studies.lock).

Windows users can use `.\.venv\Scripts\python.exe` and the PowerShell `TWIN_PYTHON` assignment in [CONTRIBUTING.md](../../CONTRIBUTING.md#before-opening-a-pull-request). Keep that interpreter selected for Node-to-Python comparisons and the native file reader. Do not change operating-system symlink policy to hide test skips; the existing guide explains the local Windows capability distinction. [Native reader contract](../engineering/build-file-reader.md).

## Local dashboard and static demo

The source uses a locked Node/React/Vite workspace. Node 24 is the contributor/CI route. Install and build from the repository root:

```sh
npm --prefix apps/web ci --ignore-scripts
npm --prefix apps/web run build
.venv/bin/python -m datacenter_twin serve --port 8000
```

Open `http://127.0.0.1:8000/`. A source checkout without the dashboard bundle intentionally returns a 503 build instruction at `/`; the calculation API can still exist. `serve` fixes the host to loopback and validates the port. Importing `create_app()` into another ASGI invocation is a separate trust-boundary choice. [datacenter_twin/cli.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/cli.py), [datacenter_twin/api.py:147–161](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/datacenter_twin/api.py#L147-L161).

For the full static browser workflow, first install the locked Python studies dependencies as above, then:

```sh
.venv/bin/python scripts/fetch_study_runtime.py
.venv/bin/python scripts/prepare_browser_demo.py
npm --prefix apps/web run test:engine
npm --prefix apps/web run build:demo
npm --prefix apps/web exec -- playwright install --with-deps chromium
npm --prefix apps/web run test:demo
```

`fetch_study_runtime.py` requires the locked local Pyodide package and verifies the two scientific wheels against its lock. `prepare_browser_demo.py` stages selected public assets and Python archives. Those steps are distinct from preparing only the two fixture JSON files needed by a native Node test subset. Full static builds and browser journeys were not executed in this authoring environment. The 18-file/132-test native subset did execute, with the two parse5-dependent build/SEO files excluded explicitly. [scripts/fetch_study_runtime.py:88–110](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/fetch_study_runtime.py#L88-L110), [scripts/prepare_browser_demo.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/prepare_browser_demo.py), [apps/web/package.json](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/package.json), [apps/web/playwright.demo.config.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/playwright.demo.config.ts).

The existing [browser development guide](../engineering/browser-demo.md) covers root and repository-subpath mounts, installed dashboard checks and optional scientific downloads. Never treat a checked-in screenshot as a fresh browser test.

## Evidence and documentation output

Use a fresh directory below `outputs/`; existing release packets are historical inputs:

```sh
.venv/bin/python scripts/build_evidence.py --output outputs/my-reproduction --revision d8dc3773830a397409a7a9c00a6ffed33c46fb4b
.venv/bin/python scripts/build_evidence.py --verify outputs/my-reproduction
```

The builder refuses an existing destination. Verification checks manifest bytes and current-engine numerical reproduction; it is not an independent external review. The audit's fresh packet contained 14 artifacts and passed both stages. See [worked labs](WORKED_EXAMPLES_AND_LABS.md) and [the evidence method](../validation/evidence-method.md).

The pinned source checkout above predates this handbook. Run the following documentation commands from a checkout containing this documentation package, and record that checkout’s actual documentation revision separately from the scientific source pin.

The added handbook uses Python's standard library plus the **Pandoc executable** to produce static HTML/MathML:

```sh
python docs/reference/build_reference.py
python docs/reference/build_reference.py --check
```

These are documentation commands, not application build replacements. The repository's software dependencies, lockfiles and workflows are unchanged. If Pandoc is absent, Markdown remains readable; regenerate and validate the checked-in HTML in a capable documentation environment before changing its inputs. [Maintenance procedure](../maintainer/DOCS_MAINTENANCE_RUNBOOK.md).
