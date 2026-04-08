#!/usr/bin/env bash
# Rebuild the app image from the current repo and recreate the container.
# With no bind mount, this is how new code reaches the dev server.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Both app and ai-worker share Dockerfile.dev; rebuild both so schema.prisma
# changes and code changes are reflected in both containers simultaneously.
SERVICES="${DOCKER_DEV_SERVICES:-app ai-worker}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "Usage: npm run deploy"
  echo "Runs: docker compose build app ai-worker && docker compose up -d app ai-worker"
  exit 0
fi

echo "deploy: docker compose build ${SERVICES}"
# shellcheck disable=SC2086
docker compose build ${SERVICES}

echo "deploy: docker compose up -d ${SERVICES}"
# shellcheck disable=SC2086
docker compose up -d ${SERVICES}

echo "deploy: done — wait for health, then http://localhost:3000"
