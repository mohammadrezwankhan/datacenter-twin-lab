"""Loopback-only application surface for pure simulation and bundled evidence."""

import asyncio
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from starlette.concurrency import run_in_threadpool
from starlette.middleware.base import RequestResponseEndpoint
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.staticfiles import StaticFiles

from . import __version__
from .browser import scenario_report, scenario_sweep
from .catalog import load_catalog, normalize_quote
from .continuity import simulate_continuity
from .contracts import MAX_SCENARIO_BYTES, InputError, Scenario, parse_json_document
from .demo import PRESETS, demo_scenario
from .engine import simulate
from .topology import SiteScenario


def _web_directory() -> Path:
    """Keep bundled evidence reachable in deeply nested Windows environments."""
    directory = os.path.normpath((Path(__file__).parent / "web").absolute())
    if os.name == "nt" and not directory.startswith("\\\\?\\"):
        # Evidence filenames include full input hashes. Prefix the trusted,
        # normalized installation root, never a path received from a client.
        if directory.startswith("\\\\"):
            directory = "\\\\?\\UNC\\" + directory[2:]
        else:
            directory = "\\\\?\\" + directory
    return Path(directory)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Datacenter Twin Lab",
        version=__version__,
        docs_url=None,
        redoc_url=None,
        description="Local synthetic calculations. No physical controls or persisted mutations.",
    )
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["localhost", "127.0.0.1", "[::1]", "testserver"],
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    slots = asyncio.Semaphore(2)

    @app.middleware("http")
    async def headers(request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; connect-src 'self'; "
            "frame-ancestors 'none'; base-uri 'none'"
        )
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(InputError)
    async def input_error(_request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=422, content={"error": str(exc)})

    async def payload(request: Request) -> Any:
        if (
            request.headers.get("content-type", "").split(";")[0].strip().lower()
            != "application/json"
        ):
            raise InputError(
                "Send application/json with the complete scenario returned by /api/v1/demo"
            )
        chunks, size = [], 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > MAX_SCENARIO_BYTES:
                raise InputError("Scenario request exceeds the 4 MiB input limit")
            chunks.append(chunk)
        return parse_json_document(b"".join(chunks))

    @app.get("/api/v1/health")
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "version": __version__,
            "mode": "SIMULATED",
            "scope": "local_stateless",
        }

    @app.get("/api/v1/presets")
    def presets() -> list[dict[str, str]]:
        return [{"id": key, "name": name} for key, name in PRESETS.items()]

    @app.get("/api/v1/demo")
    def demo(preset: str = "utility_loss") -> dict[str, Any]:
        return demo_scenario(preset).to_dict()

    @app.post(
        "/api/v1/simulations",
        summary="Calculate a schema-v2 scenario without persisting or actuating anything",
    )
    async def run(request: Request) -> dict[str, Any]:
        scenario = SiteScenario.from_dict(await payload(request))
        async with slots:
            result = await run_in_threadpool(simulate_continuity, scenario)
        return result.to_dict()

    @app.post("/api/v1/planning", summary="Evaluate an existing schema-v1 PUE scenario")
    async def planning(request: Request) -> dict[str, Any]:
        return simulate(Scenario.from_dict(await payload(request)))

    @app.get("/api/v1/catalog")
    def catalog() -> dict[str, Any]:
        return load_catalog()

    @app.post("/api/v1/reports", summary="Render a reproducible report from a validated scenario")
    async def report(request: Request) -> dict[str, Any]:
        data = await payload(request)
        async with slots:
            return await run_in_threadpool(scenario_report, data)

    @app.post("/api/v1/sweeps", summary="Run a bounded one-parameter sensitivity sweep")
    async def sweep(request: Request) -> dict[str, Any]:
        data = await payload(request)
        async with slots:
            return await run_in_threadpool(scenario_sweep, data)

    @app.post(
        "/api/v1/quotes/normalize",
        summary="Normalize an assumed rate using the selected offering's declared billing unit",
    )
    async def quote(request: Request) -> dict[str, Any]:
        return normalize_quote(await payload(request))

    web = _web_directory()
    if (web / "index.html").is_file():
        app.mount("/", StaticFiles(directory=web, html=True), name="dashboard")
    else:

        @app.get("/")
        def build_required() -> JSONResponse:
            return JSONResponse(
                status_code=503,
                content={
                    "error": ("Dashboard is not built. Run npm ci and npm run build in apps/web.")
                },
            )

    return app
