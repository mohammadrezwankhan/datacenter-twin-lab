# Local API and dashboard

Start with `python -m datacenter_twin serve` after installing the optional API dependencies. The [released wheel](../quickstart.md#run-the-released-dashboard-python-only) includes the compiled dashboard; a source checkout requires building `apps/web` first. The CLI binds only to `127.0.0.1:8000`; `--port` accepts 1–65535. The compiled React dashboard is served from the same process and origin. OpenAPI operation metadata is available at `/openapi.json`. The exact input and output fields are documented in [electrical-v2.md](electrical-v2.md); the domain constructors enforce constraints that OpenAPI metadata alone does not express.

| Method / path | Input | Result |
| --- | --- | --- |
| `GET /api/v1/health` | None | Version, `SIMULATED` mode, local/stateless scope |
| `GET /api/v1/presets` | None | Five preset IDs and labels |
| `GET /api/v1/demo?preset=utility_loss` | Optional preset ID | Complete schema-2 input, including topology and events |
| `POST /api/v1/simulations` | Complete schema-2 scenario JSON | One complete `SimulationRun` |
| `POST /api/v1/planning` | Existing schema-1 scenario JSON | Existing PUE planning result |
| `GET /api/v1/catalog` | None | Dated hardware, cloud, model-route, jurisdiction and source records |
| `POST /api/v1/quotes/normalize` | `offer_id`, integer `node_count`, decimal `billed_hours`, nullable decimal `assumed_rate` | Whole-node/GPU-hour normalization with embedded offer, inputs, sources and limitations |

POST requests require `Content-Type: application/json`, unique keys and at most 4 MiB of UTF-8 JSON. Contract errors return HTTP 422 with an `error` string. Malformed encoding, duplicate keys, wrong types and excessive nesting use the same contract error boundary. Two continuity calculations can execute at once; additional requests wait locally. No request is persisted.

Example in PowerShell, using only local HTTP:

```powershell
$scenario = Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/demo?preset=generator_failure'
$scenario.it_demand_kw = '1200'
$body = $scenario | ConvertTo-Json -Depth 20
$run = Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/simulations' -Method Post -ContentType 'application/json' -Body $body
$run.summary
```

The API has calculation POSTs and catalogue GETs, with no database mutations or physical controls. Host validation allows loopback names; CORS permits the two documented local Vite origins. Browser responses include a same-origin content policy and API responses disable caching. This is a local single-user tool: it has no login, tenant isolation, rate-limited shared queue or durable audit. Authentication, authorization, persistence, TLS and deployment recovery are prerequisites for a separately designed shared service. Do not override the loopback bind to treat this version as that service.

The browser keeps its saved baseline only in memory. Reloading clears it; export the full run to retain evidence. Replay displays precomputed intervals. Changing controls labels results as belonging to the previous run until the replacement succeeds. Request errors preserve the previous result and allow correction. Cloud rate normalization is a separate assumption calculation and never alters the electrical simulation's energy ledger.

The catalogue includes one dated Azure East US retail snapshot with a retained meter response. The browser can explicitly copy that value into the assumption form; this does not refresh the price or convert it into an account quote. AWS and OCI numeric rates remain unknown. Vendor catalogue units and memory units are preserved, including AWS's GiB and Azure/OCI's GB.
