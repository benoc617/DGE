#!/bin/sh
set -e
cd /app

export PORT="${PORT:-3000}"

# --- Root phase: fix named-volume ownership so the non-root user can write ---
# The node_modules and .next named volumes are created by Docker as root.
# Prisma generate and Next.js need write access, so chown them before dropping privileges.
if [ "$(id -u)" = "0" ]; then
  echo "[srx] fixing volume ownership for node user…"
  chown -R node:node /app/node_modules /app/.next 2>/dev/null || true

  # Re-exec this script as the non-root `node` user (uid 1000) via setpriv (C binary, no Go stdlib)
  exec setpriv --reuid=node --regid=node --clear-groups -- "$0" "$@"
fi

# --- Non-root phase (running as `node`) ---

# node_modules is a named volume over /app/node_modules. If it was filled on the host (wrong OS),
# is empty, or optional native deps failed partially, Tailwind → lightningcss breaks at runtime.
if ! node -e "require('lightningcss')" 2>/dev/null; then
  echo "[srx] lightningcss native binding missing or broken — running npm ci…"
  npm ci
fi
if ! node -e "require('lightningcss')" 2>/dev/null; then
  echo "[srx] FATAL: lightningcss still fails after npm ci. Remove the node_modules volume or fix optional deps." >&2
  exit 1
fi

echo "[srx] prisma generate + db push…"
npx prisma generate
npx prisma db push

echo "[srx] starting Next.js dev server on 0.0.0.0:${PORT} (user: $(whoami))…"
exec npm run dev -- --hostname 0.0.0.0 --port "${PORT}"
