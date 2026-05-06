#!/usr/bin/env bash
set -euo pipefail

PROXY_HOST="${CLAUDE_PROXY_HOST:-127.0.0.1}"
PROXY_PORT="${CLAUDE_PROXY_PORT:-8765}"

export ANTHROPIC_BASE_URL="http://${PROXY_HOST}:${PROXY_PORT}"

exec claude "$@"
