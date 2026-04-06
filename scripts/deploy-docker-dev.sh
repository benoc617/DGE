#!/usr/bin/env bash
# Local Docker Compose only: restart the Next.js app container.
# Source is bind-mounted from this repo — no rsync or remote hosts.
# Use when the dev server is already up and you want a clean restart (e.g. env / stuck process).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SERVICE="${DOCKER_DEV_SERVICE:-app}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "Usage: npm run deploy"
  echo "Restarts docker compose service: ${SERVICE} (override with DOCKER_DEV_SERVICE)"
  exit 0
fi

echo "deploy: docker compose restart ${SERVICE}"
docker compose restart "${SERVICE}"
echo "deploy: done."
