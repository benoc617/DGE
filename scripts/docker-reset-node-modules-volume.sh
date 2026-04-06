#!/usr/bin/env bash
# Drop Compose named volumes for app node_modules and .next, remove the app container,
# rebuild the image, and start the stack. Fixes:
#   - missing lightningcss-* native binaries (fresh npm ci)
#   - stale Turbopack/PostCSS cache in .next that still 500s on globals.css even when
#     node -e "require('lightningcss')" succeeds (clear srx_next volume).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> stopping and removing app container (releases volumes)"
docker compose stop app
docker compose rm -f app

for suffix in _srx_node_modules _srx_next; do
  VOL="$(docker volume ls -q | grep "${suffix}\$" | head -n1 || true)"
  label="${suffix#_srx_}"
  echo "==> removing ${label} volume (if present)"
  if [[ -n "${VOL}" ]]; then
    echo "    ${VOL}"
    docker volume rm "${VOL}"
  else
    echo "    (none found — compose will create a fresh one on up)"
  fi
done

echo "==> rebuild app image + start stack"
docker compose build app
docker compose up -d

echo "==> done — wait for app health, then http://localhost:3000"
echo "    If npm ci OOMs in the container, raise Docker memory or run:"
echo "    docker compose run --rm --no-deps --entrypoint \"\" app sh -c \"npm ci\""
