"""Loopback-only application surface for pure simulation and bundled evidence."""

import asyncio
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.staticfiles import StaticFiles

from . import __version__
from .catalog import load_catalog, normalize_quote
from .contracts import InputError, MAX_SCENARIO_BYTES, Scenario, parse_json_document
from .continuity import simulate_continuity
from .demo import PRESETS, demo_scenario
from .engine import simulate
from .topology import SiteScenario


def create_app() -> FastAPI:
    app = FastAPI(title="Datacenter Twin Lab", version=__version__, docs_url=None, redoc_url=None,
                  description="Local synthetic calculations. No physical controls or persisted mutations.")
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "[::1]", "testserver"])
    app.add_middleware(CORSMiddleware, allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
                       allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
    slots = asyncio.Semaphore(2)

    @app.middleware("http")
    async def headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(InputError)
    async def input_error(request, exc):
        return JSONResponse(status_code=422, content={"error": str(exc)})

    async def payload(request):
        if request.headers.get("content-type", "").split(";")[0].strip().lower() != "application/json":
            raise InputError("Send application/json with the complete scenario returned by /api/v1/demo")
        chunks, size = [], 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > MAX_SCENARIO_BYTES:
                raise InputError("Scenario request exceeds the 4 MiB input limit")
            chunks.append(chunk)
        return parse_json_document(b"".join(chunks))

    @app.get("/api/v1/health")
    def health():
        return {"status":"ok", "version":__version__, "mode":"SIMULATED", "scope":"local_stateless"}

    @app.get("/api/v1/presets")
    def presets():
        return [{"id":key,"name":name} for key,name in PRESETS.items()]

    @app.get("/api/v1/demo")
    def demo(preset: str = "utility_loss"):
        return demo_scenario(preset).to_dict()

    @app.post("/api/v1/simulations", summary="Calculate a schema-v2 scenario without persisting or actuating anything")
    async def run(request: Request):
        scenario = SiteScenario.from_dict(await payload(request))
        async with slots:
            result = await run_in_threadpool(simulate_continuity, scenario)
        return result.to_dict()

    @app.post("/api/v1/planning", summary="Evaluate an existing schema-v1 PUE scenario")
    async def planning(request: Request):
        return simulate(Scenario.from_dict(await payload(request)))

    @app.get("/api/v1/catalog")
    def catalog():
        return load_catalog()

    @app.post("/api/v1/quotes/normalize", summary="Normalize an assumed rate using the selected offering's declared billing unit")
    async def quote(request: Request):
        return normalize_quote(await payload(request))

    web = Path(__file__).parent / "web"
    if (web / "index.html").is_file():
        app.mount("/", StaticFiles(directory=web, html=True), name="dashboard")
    else:
        @app.get("/")
        def build_required():
            return JSONResponse(status_code=503, content={"error":"Dashboard is not built. Run npm ci and npm run build in apps/web."})
    return app
