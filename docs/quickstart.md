# Quickstart

![Datacenter Twin Lab visual concept for the champion roadmap](images/datacenter-twin-lab-cover-v1.png)

For a zero-install first run, open the [browser demo](https://mohammadrezwankhan.github.io/datacenter-twin-lab/); it runs Python on your device and requires no account. See the [browser guide](engineering/browser-demo.md) for download size and privacy. For a local installation, choose the released dashboard to explore the model with Python and a browser, or use the source checkout to edit code and run the full tests. Both routes require Python 3.12 or later. The CLI and electrical engine use only the standard library; the dashboard server needs the optional API dependencies.

## Run with uv

If [uv is installed](https://docs.astral.sh/uv/getting-started/installation/), run the released CLI from an empty working folder with one command. `uvx` creates a cached, isolated environment; it downloads Python 3.12 if needed. Git, Node, and a source checkout are unnecessary.

```sh
uvx --python 3.12 --from "datacenter-twin-lab @ https://github.com/mohammadrezwankhan/datacenter-twin-lab/releases/download/v0.3.0a0/datacenter_twin_lab-0.3.0a0-py3-none-any.whl#sha256=b951f6877fb323c8ff3a064558054383d4d1582e753e52c0a0c35b06a42739db" datacenter-twin simulate --preset generator_failure --format markdown
```

For the local dashboard, use the same released wheel with its API extra:

```sh
uvx --python 3.12 --from "datacenter-twin-lab[api] @ https://github.com/mohammadrezwankhan/datacenter-twin-lab/releases/download/v0.3.0a0/datacenter_twin_lab-0.3.0a0-py3-none-any.whl#sha256=b951f6877fb323c8ff3a064558054383d4d1582e753e52c0a0c35b06a42739db" datacenter-twin serve
```

Open [127.0.0.1:8000](http://127.0.0.1:8000); stop with Ctrl+C. Append `--port 8001` if that port is occupied. These commands work in PowerShell and POSIX shells. They pin the GitHub wheel and its digest; this project is **not published on PyPI**. The API extra resolves compatible transitive dependencies from the package index. Use the locked source workflow for the exact development dependency set.

The route was exercised with uv 0.12.11 and Python 3.12.14 on Windows, outside the checkout, including a real CLI report and dashboard run. For an installed Python 3.12+, `--python` can also take its executable path. See [uv's tool isolation and source options](https://docs.astral.sh/uv/guides/tools/). If you prefer pip, use the following route.

## Run the released dashboard (Python only)

In an empty working folder, create an isolated environment and install the public `0.3.0a0` wheel with its `api` extra. These commands call the environment's Python directly, so no activation script is needed. The URL pins the release asset and its SHA-256 hash; it does not rely on a PyPI publication of this project.

Windows / PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install "datacenter-twin-lab[api] @ https://github.com/mohammadrezwankhan/datacenter-twin-lab/releases/download/v0.3.0a0/datacenter_twin_lab-0.3.0a0-py3-none-any.whl#sha256=b951f6877fb323c8ff3a064558054383d4d1582e753e52c0a0c35b06a42739db"
.\.venv\Scripts\python.exe -m datacenter_twin serve
```

macOS / Linux:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install "datacenter-twin-lab[api] @ https://github.com/mohammadrezwankhan/datacenter-twin-lab/releases/download/v0.3.0a0/datacenter_twin_lab-0.3.0a0-py3-none-any.whl#sha256=b951f6877fb323c8ff3a064558054383d4d1582e753e52c0a0c35b06a42739db"
.venv/bin/python -m datacenter_twin serve
```

Use a Python executable at version 3.12 or later; for example, replace the first Windows `python` with `py -3.12` if you use that launcher. Your Python installation must include pip and venv support. The initial installation needs network access to GitHub and the dependency package index. It installs the built interface and API dependencies; Git, Node, an API key and a cloud account are not required. The release pins FastAPI and Uvicorn; this convenient extra resolves their compatible transitive dependencies. Use the locked source workflow below when you need the repository's exact development dependency set.

Open [127.0.0.1:8000](http://127.0.0.1:8000). Select **Generator failure / battery depletion**, run the scenario, and select the `607.8 s` battery-depleted event. Served IT power drops to zero until restoration at `900 s`. The source is synthetic and the tariff is fictional. Try **A-path maintenance / surviving overload** to see 665 kW served and 335 kW unserved during the outage interval. [The tutorial](tutorials/continuity-walkthrough.md) derives both results.

Stop the server with Ctrl+C. If port 8000 is occupied, append `--port 8001` to the serve command and open port 8001. After stopping, you can run the bundled CLI preset in the same environment:

```powershell
# Windows / PowerShell
.\.venv\Scripts\python.exe -m datacenter_twin simulate --preset generator_failure
```

```sh
# macOS / Linux
.venv/bin/python -m datacenter_twin simulate --preset generator_failure
```

The presets and catalogue ship in the wheel. Source-only files such as `data/scenarios/baseline-1mw.json` and the test suite require the checkout below. Avoid running the installed dashboard from inside an unbuilt source checkout, where Python can import that checkout instead of the installed package. The server binds to loopback; this is a local research tool with no physical controls or calibrated facility claims.

## Run from source

Clone the [public repository](https://github.com/mohammadrezwankhan/datacenter-twin-lab), then open a terminal in its root:

```sh
python -m datacenter_twin --version
python -m datacenter_twin run data/scenarios/baseline-1mw.json --output outputs/baseline.json
python -m datacenter_twin compare data/scenarios/baseline-1mw.json data/scenarios/alternative-pue-115.json --output outputs/comparison.json
python -m datacenter_twin simulate --preset generator_failure --output outputs/outage.json
python -m unittest discover -s tests -v
```

The same module commands work in PowerShell. If `python` opens the Microsoft Store, use the path to an installed Python executable or your Python launcher (`py -3.12`). The launcher alternative is environment-dependent; the module commands were tested using a concrete Python 3.12.14 executable.

Inspect `outputs/comparison.json`: `facility_energy_saving_kwh` is `"876000"` and `energy_only_cost_saving` is `"87600.00"`. Power, energy, rates and cost outputs are decimal strings; unavailable quantities are null. Counts and input duration/step fields remain integers. The output includes the full assumptions, engine version, source IDs, input hashes and stable run IDs.

Edit a copy of a scenario. Each interval has a label, duration in hours, IT demand in kW and assumed PUE. The tariff is per facility kWh. Increase IT demand to see consistent changes to energy, cost and capacity margin. Use `null` tariff plus `"unknown"` price status to see an explicitly unknown cost.

Comparisons require identical IT load intervals and currency. This prevents a shorter or smaller workload from being reported as an efficiency saving. Changes to capacity, PUE and tariff remain visible in each result's assumptions.

`outputs/` is ignored by Git. Choose a new export path on each run, or add `--force` to replace an existing result. The CLI protects the input even when the output is a hard-link alias. Symbolic-link outputs are rejected. A failed write preserves the previous result. Normal atomic creation requires a filesystem supporting hard links, as tested on the Windows/Linux environments; unsupported filesystems return an error. The program returns exit code 2 with a useful message for invalid input, including files larger than 4 MiB.

## Local dashboard

Create a virtual environment if desired (`python -m venv .venv`), activate it, and install Node 24 for the frontend build. For reproducible API and browser dependencies:

```sh
python -m pip install -r requirements-api.lock
python -m pip install -e . --no-deps
npm --prefix apps/web ci --ignore-scripts
npm --prefix apps/web run build
python -m datacenter_twin serve
```

Open [127.0.0.1:8000](http://127.0.0.1:8000). Stop with Ctrl+C. Use `--port 8001` if the default port is occupied. The CLI cannot bind externally. The minimal API-only install is `python -m pip install -e ".[api]"`; the lock file also includes HTTP test dependencies and pins transitive versions. The `test-api` extra is available for development.

Select **Generator failure / battery depletion**, then select the battery-depleted event to see zero served IT power. Select utility restoration to see recovery and charging. Change IT demand and run again; unapplied controls do not silently alter existing results. **Save baseline** lasts for the browser session; **Export run** downloads the exact API result. The CLI uses a `result` envelope and export timestamp around that same run. No account, GPU or cloud resource is needed.

For a custom graph, copy [reference-site-v2.json](../datacenter_twin/resources/reference-site-v2.json), edit it under the [schema-2 rules](contracts/electrical-v2.md), then run `python -m datacenter_twin simulate --scenario path/to/copy.json`. Schema-1 PUE inputs remain supported by `run` and `compare`; they cannot infer electrical topology.

For frontend development, leave the API running and use `npm --prefix apps/web run dev`; open port 5173. Vite proxies `/api` to loopback port 8000. The production build writes only generated assets under `datacenter_twin/web/`; build that directory before packaging a wheel with a dashboard.

Browser verification from `apps/web`:

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

Playwright starts a local Python server. If your virtual environment is not activated, set `TWIN_PYTHON` to its Python executable. In PowerShell use `$env:TWIN_PYTHON = 'C:\path\to\venv\Scripts\python.exe'`. No browser provider or external API account is used.

## Package verification

With pip available, build a wheel and test a clean installation outside the repository:

```sh
python -m pip wheel . --no-deps --wheel-dir dist
python scripts/verify_distribution.py dist --require-web
```

The verifier expects exactly one project wheel in the selected directory. Use a separate directory for each retained version. The build retrieves the pinned setuptools backend if uncached. The verifier creates a temporary environment, installs the local wheel with `--no-index --no-deps`, checks import/version identity and exercises both entry points plus continuity and catalogue resources. Schema-1 samples are copied from this repository. The schema-2 demo and catalogue are package resources. `--require-web` also checks that the compiled dashboard is included; omit it for an intentional CLI-only wheel. The installed core needs no network; an installed dashboard server still requires the optional API dependencies.

CI runs the core and API tests, frontend type check/build, and installed-wheel verification on Windows/Ubuntu with Python 3.12/3.14. Browser journeys run on Ubuntu/Python 3.12. PyPI publication remains pending a configured owner publishing identity; the verified GitHub wheel supports both pip and uv today. Containers and shared deployment are outside this delivery.
