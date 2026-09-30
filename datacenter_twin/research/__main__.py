"""Export an advanced study using the same source as the browser worker."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from datacenter_twin.output import write_result
from . import STUDY_DEFAULTS, run_study


def main() -> None:
    parser = argparse.ArgumentParser(description="Bounded power-dynamics teaching studies")
    parser.add_argument("--study", choices=tuple(STUDY_DEFAULTS), required=True)
    parser.add_argument("--config", type=Path, help="JSON object of study parameter overrides")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    try:
        if args.force and not args.output:
            raise ValueError("--force requires --output")
        config = json.loads(args.config.read_text(encoding="utf-8")) if args.config else {}
        result = run_study(args.study, config)
        content = json.dumps(result, indent=2, allow_nan=False) + "\n"
        if args.output:
            write_result(
                args.output,
                content,
                protected_paths=[args.config] if args.config else [],
                force=args.force,
            )
            print(f"Saved power-dynamics study: {args.output}")
        else:
            print(content, end="")
    except (OSError, ValueError, RuntimeError) as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
