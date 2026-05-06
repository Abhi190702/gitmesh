#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE_NAME="${IMAGE_NAME:-gitmesh-agents-e2e}"
HOST_PORT="${HOST_PORT:-3131}"
GITMESH_VERSION="${GITMESH_VERSION:-latest}"
DATA_DIR="${DATA_DIR:-$REPO_ROOT/data/docker-e2e}"
HOST_UID="${HOST_UID:-$(id -u)}"
GITMESH_DEPLOYMENT_MODE="${GITMESH_DEPLOYMENT_MODE:-authenticated}"
GITMESH_DEPLOYMENT_EXPOSURE="${GITMESH_DEPLOYMENT_EXPOSURE:-private}"
DOCKER_TTY_ARGS=()

if [[ -t 0 && -t 1 ]]; then
  DOCKER_TTY_ARGS=(-it)
fi

mkdir -p "$DATA_DIR"

echo "==> Building setup e2e image"
docker build \
  --build-arg GITMESH_VERSION="$GITMESH_VERSION" \
  --build-arg HOST_UID="$HOST_UID" \
  -f "$REPO_ROOT/Dockerfile.e2e" \
  -t "$IMAGE_NAME" \
  "$REPO_ROOT"

echo "==> Running setup e2e container"
echo "    UI should be reachable at: http://localhost:$HOST_PORT"
echo "    Data dir: $DATA_DIR"
echo "    Deployment: $GITMESH_DEPLOYMENT_MODE/$GITMESH_DEPLOYMENT_EXPOSURE"
echo "    Live output: setup banner and server logs stream in this terminal (Ctrl+C to stop)"
docker run --rm \
  "${DOCKER_TTY_ARGS[@]}" \
  --name "${IMAGE_NAME//[^a-zA-Z0-9_.-]/-}" \
  -p "$HOST_PORT:3100" \
  -e HOST=0.0.0.0 \
  -e PORT=3100 \
  -e GITMESH_DEPLOYMENT_MODE="$GITMESH_DEPLOYMENT_MODE" \
  -e GITMESH_DEPLOYMENT_EXPOSURE="$GITMESH_DEPLOYMENT_EXPOSURE" \
  -v "$DATA_DIR:/gitmesh-agents" \
  "$IMAGE_NAME"
