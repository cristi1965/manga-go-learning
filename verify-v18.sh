#!/bin/sh
set -eu
cd "$(dirname "$0")"
RUNTIME_ROOT=${CODEX_RUNTIME_ROOT:-"$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"}
PYTHON=${MANGA_GO_PYTHON:-"$RUNTIME_ROOT/python/bin/python3"}
NODE=${MANGA_GO_NODE:-"$RUNTIME_ROOT/node/bin/node"}
NPM=${MANGA_GO_NPM:-"$(command -v npm || true)"}
[ -x "$PYTHON" ] || PYTHON=$(command -v python3)
[ -x "$NODE" ] || NODE=$(command -v node)
if [ ! -d node_modules/playwright ] || [ ! -d node_modules/axe-core ]; then
  [ -n "$NPM" ] || { echo "npm is required to install browser audit dependencies" >&2; exit 1; }
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 "$NPM" ci
fi
export MANGA_GO_NODE="$NODE"
exec "$PYTHON" verify_v18.py
