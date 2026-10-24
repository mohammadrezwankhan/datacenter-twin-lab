#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
printf "Installing Codex CLI...\n"
npm install --global @openai/codex@0.164.0
codex --version

# Keep generated dependency directories out of local Git status.
exclude_file="$(git rev-parse --git-path info/exclude)"
mkdir -p "$(dirname "$exclude_file")"
touch "$exclude_file"
for pattern in .venv/ node_modules/; do
  grep -qxF "$pattern" "$exclude_file" || printf "%s\n" "$pattern" >> "$exclude_file"
done

# Install Node dependencies in apps/web.
(
  cd apps/web
  if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then
    npm ci --no-audit --no-fund
  else
    npm install --package-lock=false --no-audit --no-fund
  fi
)

# Isolate Python dependencies in ./.venv.
(
  cd .
  python3.12 -m venv .venv
  .venv/bin/python -m pip install --upgrade pip
  if [ -f requirements.lock ]; then
    .venv/bin/python -m pip install -r requirements.lock
  elif [ -f requirements.txt ]; then
    .venv/bin/python -m pip install -r requirements.txt
  fi
  if [ -f requirements.lock ]; then
    .venv/bin/python -m pip install -e '.[api,test-api]' -c requirements.lock
  else
    .venv/bin/python -m pip install -e '.[api,test-api]'
  fi
  if [ -f requirements-dev.txt ]; then
    .venv/bin/python -m pip install -r requirements-dev.txt
  fi
)

printf "\nSetup complete. Sign in with: codex login --device-auth\n"
printf "Then run: codex\n"
