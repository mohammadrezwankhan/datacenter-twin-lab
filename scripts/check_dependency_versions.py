"""Verify that a declared extra, its lock and the installed environment agree."""
import argparse
import importlib.metadata
from pathlib import Path
import re
import tomllib

root = Path(__file__).resolve().parents[1]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lock-only', action='store_true', help='Check pins offline before installing dependencies')
    parser.add_argument('extras', nargs='+', choices=['api', 'test-api', 'studies'])
    args = parser.parse_args(argv)
    metadata = tomllib.loads((root / 'pyproject.toml').read_text(encoding='utf-8'))
    for extra in args.extras:
        lock_name = 'requirements-studies.lock' if extra == 'studies' else 'requirements-api.lock'
        lock = (root / lock_name).read_text(encoding='utf-8')
        for requirement in metadata['project']['optional-dependencies'][extra]:
            match = re.fullmatch(r'([A-Za-z0-9_.-]+)==([^;\s]+)', requirement)
            if match is None:
                raise SystemExit(f'Expected an exact extra pin: {requirement}')
            name, expected = match.groups()
            if requirement not in lock.splitlines():
                raise SystemExit(f'{requirement} is missing from {lock_name}')
            if not args.lock_only:
                actual = importlib.metadata.version(name)
                if actual != expected:
                    raise SystemExit(f'{name}: installed {actual}, declared {expected}')
            print(f'{extra}: {requirement}')


if __name__ == '__main__':
    main()
