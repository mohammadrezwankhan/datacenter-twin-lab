# Dependency validation

Native scientific dependencies intentionally differ from the pinned Pyodide browser distribution: native NumPy 2.5.5 and SciPy 1.18.1; browser NumPy 2.4.6 and SciPy 1.18.0 in Pyodide 314.0.8. The browser packages remain hash verified. Pyodide 314.0.8 retains the same NumPy/SciPy wheel names, SHA-256 hashes, Python 3.14.2 and ABI as 314.0.7; the runtime update still requires the existing browser parity checks. This is a software parity policy, not a claim of scientific calibration. Both versions must satisfy the existing differential checks without changing numerical tolerances under the project and root demo base paths. CI failures block integration.

CI installs API/study extras together with their locks, runs pip check, and verifies installed versions against project metadata and the lock. React and React DOM remain paired at 19.3.1, with a prebuild installed-version guard and a grouped Dependabot update including their type packages. React type patch numbers may differ from runtime patch numbers. The frontend uses Vite 8.4.0 with plugin-react 6.3.0.

The root lint toolchain retains TypeScript 6.0.3 because typescript-eslint 8.74.0 declares a TypeScript peer range of `>=4.8.4 <6.1.0`. The application compiler remains TypeScript 7.0.2. These separate pins are intentional; installing the newest application compiler into the lint toolchain would violate that peer contract. ESLint 10.16.0, config-array 0.23.7 and typescript-estree 8.74.0 now declare compatible minimatch 11 ranges, so the former exact-parent security overrides are removed. The regenerated root lock selects minimatch 11.0.9, subject to the existing glob behavior and authored-source lint checks.

The API and studies pins live in `requirements-api.txt` and
`requirements-studies.txt` so Dependabot can discover them. The old `.lock`
filenames include the corresponding pin files for existing install commands.

The 27 November 2026 maintenance refresh used Python 3.12.14, uv 0.13.9, Node 24.22.3 and npm 11.19.1. It selected FastAPI 0.165.0 and explicitly refreshed its compatible annotated-doc, click, Pydantic/pydantic-core and Starlette lock entries. Declared native NumPy/SciPy versions remain unchanged. Current package metadata and lock regeneration establish dependency identity; they do not substitute for installed API tests, browser execution or exact-source CI.

## Refreshing the API dependency lock

CI checks all direct extra pins against their locks before downloading packages:

```sh
python scripts/check_dependency_versions.py --lock-only api test-api studies
```

This offline check catches manifest-only dependency updates early. The existing
installed-version check, resolver, `pip check` and runtime tests still apply.

When changing a direct dependency of the `api` or `test-api` extras in
`pyproject.toml`, update `requirements-api.txt` in the same change. The
committed lock is used for source-checkout API testing and CI; changing only the
project metadata can make installation fail before tests start.

From the repository root, with `uv` installed, first change the intended
direct dependency pin in `pyproject.toml`, then regenerate the lock with a
*targeted* upgrade. For example, after changing FastAPI:

```sh
uv pip compile pyproject.toml --extra api --extra test-api --universal --python-version 3.12 --no-header --no-annotate --output-file requirements-api.txt --upgrade-package fastapi
```

Replace `fastapi` with the direct dependency you changed. Do not use a
blanket `--upgrade`: the targeted option keeps other pinned versions unless
the new dependency requires a compatible change. Inspect the lock diff and
investigate any unrelated version changes before committing. Record the Python
and `uv` versions used to regenerate it.

Use the same Python 3.12-or-newer virtual environment created in
[CONTRIBUTING.md](../../CONTRIBUTING.md) throughout validation. On Windows /
PowerShell:

```powershell
.\.venv\Scripts\python.exe -c "import sys; print(sys.executable, sys.version)"
.\.venv\Scripts\python.exe -m pip install -r requirements-api.txt ".[api,test-api]"
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe scripts/check_dependency_versions.py api test-api
.\.venv\Scripts\python.exe -m unittest tests.test_api -v
```

On macOS or Linux:

```sh
.venv/bin/python -c "import sys; print(sys.executable, sys.version)"
.venv/bin/python -m pip install -r requirements-api.txt ".[api,test-api]"
.venv/bin/python -m pip check
.venv/bin/python scripts/check_dependency_versions.py api test-api
.venv/bin/python -m unittest tests.test_api -v
```

These are source-checkout maintenance steps; they do not alter an already
published, version-pinned release wheel or publish a package. Keep browser /
Pyodide dependencies, electrical calculations and unrelated generated files
out of an API-lock refresh PR.
