#!/usr/bin/env bash
# Rebuild Compose images, start the dev stack, refresh Prisma Client in the app
# container, and restart the app (matches: build → deploy → prisma generate → restart).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> docker compose up --build -d"
docker compose up --build -d

echo "==> prisma generate (app container)"
docker compose exec -T app npx prisma generate

echo "==> restart app"
docker compose restart app

echo "==> done — http://localhost:3000 (Postgres on host: localhost:5433)"
