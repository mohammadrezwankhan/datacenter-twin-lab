"""Offline CLI for synthetic scenario evaluation and comparison."""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

from . import __version__
from .contracts import InputError, load_json_document, load_scenario
from .engine import compare, simulate
from .output import write_result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Datacenter Twin Lab: synthetic planning, preliminary")
    parser.add_argument("--version", action="version", version=__version__)
    commands = parser.add_subparsers(dest="command", required=True)
    run = commands.add_parser("run", help="Evaluate a local JSON scenario")
    run.add_argument("scenario", type=Path)
    comparison = commands.add_parser("compare", help="Compare scenarios with identical IT load intervals")
    comparison.add_argument("baseline", type=Path)
    comparison.add_argument("alternative", type=Path)
    continuity = commands.add_parser("simulate", help="Run a schema-v2 electrical continuity scenario")
    source = continuity.add_mutually_exclusive_group()
    source.add_argument("--scenario", type=Path)
    source.add_argument("--preset", default="utility_loss", choices=["normal","utility_loss","generator_failure","path_maintenance","shared_domain"])
    serve = commands.add_parser("serve", help="Serve the local API and built dashboard on loopback")
    serve.add_argument("--port", type=int, default=8000)
    for command in (run, comparison, continuity):
        command.add_argument("--output", type=Path, help="Write a JSON result to this path")
        command.add_argument("--force", action="store_true", help="Replace an existing result file")
    args = parser.parse_args(argv)
    if args.command == "serve":
        if not 1 <= args.port <= 65535:
            parser.error("--port must be from 1 to 65535")
        try:
            import uvicorn
            from .api import create_app
        except ImportError:
            parser.error('Install the API extra: python -m pip install -e ".[api]"')
        uvicorn.run(create_app(), host="127.0.0.1", port=args.port, access_log=False)
        return 0
    if args.force and not args.output:
        parser.error("--force requires --output")
    try:
        if args.command == "run":
            input_paths = [args.scenario]
            result = simulate(load_scenario(args.scenario))
        elif args.command == "compare":
            input_paths = [args.baseline, args.alternative]
            result = compare(load_scenario(args.baseline), load_scenario(args.alternative))
        else:
            from .continuity import simulate_continuity
            from .demo import demo_scenario
            from .topology import SiteScenario
            input_paths = [args.scenario] if args.scenario else []
            scenario = SiteScenario.from_dict(load_json_document(args.scenario)) if args.scenario else demo_scenario(args.preset)
            result = simulate_continuity(scenario).to_dict()
        payload = {"generated_at_utc": datetime.now(timezone.utc).isoformat(), "result": result}
        content = json.dumps(payload, indent=2, ensure_ascii=True, allow_nan=False) + "\n"
        if args.output:
            write_result(args.output, content, protected_paths=input_paths, force=args.force)
            print(f"Saved synthetic planning result: {args.output}")
        else:
            print(content, end="")
    except (InputError, OSError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    return 0
