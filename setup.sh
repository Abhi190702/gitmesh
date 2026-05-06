#!/usr/bin/env bash
# One-command setup wrapper for macOS / Linux.
# Forwards all args to scripts/setup.mjs.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js is not installed."
  echo "  Install Node 20+ from https://nodejs.org/ and re-run ./setup.sh"
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "✗ Node $NODE_MAJOR detected. GitMesh requires Node 20 or newer."
  echo "  Install Node 20+ from https://nodejs.org/ and re-run ./setup.sh"
  exit 1
fi

exec node "$SCRIPT_DIR/scripts/setup.mjs" "$@"
