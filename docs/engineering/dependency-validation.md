# Dependency validation

Native scientific dependencies intentionally differ from the pinned Pyodide browser distribution: native NumPy 2.5.4 and SciPy 1.18.1; browser NumPy 2.4.6 and SciPy 1.18.0 in Pyodide 314.0.7. The browser packages remain hash verified. This is a software parity policy, not a claim of scientific calibration. Both versions must satisfy the existing differential checks without changing numerical tolerances under the project and root demo base paths. CI failures block integration.

CI installs API/study extras together with their locks, runs pip check, and verifies installed versions against project metadata and the lock. React and React DOM are updated together, with a prebuild installed-version guard and a grouped Dependabot update including their type packages. React type patch numbers may differ from runtime patch numbers. Vite 8.3.5 includes the launch-editor security fixes reported for the previous 8.2.2 pin.

## Refreshing the API dependency lock

When changing a direct dependency of the `api` or `test-api` extras in
`pyproject.toml`, update `requirements-api.lock` in the same change. The
committed lock is used for source-checkout API testing and CI; changing only the
project metadata can make installation fail before tests start.

From the repository root, with `uv` installed, first change the intended
direct dependency pin in `pyproject.toml`, then regenerate the lock with a
*targeted* upgrade. For example, after changing FastAPI:

```sh
uv pip compile pyproject.toml --extra api --extra test-api --universal --python-version 3.12 --output-file requirements-api.lock --upgrade-package fastapi
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
.\.venv\Scripts\python.exe -m pip install -r requirements-api.lock ".[api,test-api]"
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe scripts/check_dependency_versions.py api test-api
.\.venv\Scripts\python.exe -m unittest tests.test_api -v
```

On macOS or Linux:

```sh
.venv/bin/python -c "import sys; print(sys.executable, sys.version)"
.venv/bin/python -m pip install -r requirements-api.lock ".[api,test-api]"
.venv/bin/python -m pip check
.venv/bin/python scripts/check_dependency_versions.py api test-api
.venv/bin/python -m unittest tests.test_api -v
```

These are source-checkout maintenance steps; they do not alter an already
published, version-pinned release wheel or publish a package. Keep browser /
Pyodide dependencies, electrical calculations and unrelated generated files
out of an API-lock refresh PR.
