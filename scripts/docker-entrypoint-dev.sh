#!/bin/sh
set -e
cd /app

export PORT="${PORT:-3000}"

# node_modules is a named volume over /app/node_modules. If it was filled on the host (wrong OS)
# or is empty, optional native deps (Tailwind → lightningcss) won't match Linux in the container.
arch="$(uname -m)"
case "$arch" in
  aarch64|arm64) _LCSS_PKG="lightningcss-linux-arm64-gnu" ;;
  x86_64|amd64) _LCSS_PKG="lightningcss-linux-x64-gnu" ;;
  *) _LCSS_PKG="" ;;
esac
if [ -n "${_LCSS_PKG}" ] && [ ! -d "node_modules/${_LCSS_PKG}" ]; then
  echo "[srx] node_modules missing ${_LCSS_PKG} for this image — running npm ci…"
  npm ci
fi

echo "[srx] prisma generate + migrate deploy…"
npx prisma generate
npx prisma migrate deploy

echo "[srx] starting Next.js dev server on 0.0.0.0:${PORT}…"
exec npm run dev -- --hostname 0.0.0.0 --port "${PORT}"
