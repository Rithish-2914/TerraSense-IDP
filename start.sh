#!/usr/bin/env bash
# Starts the TerraSense backend and frontend together. Ctrl-C stops both.
set -euo pipefail
cd "$(dirname "$0")"

BACKEND_PORT="${PORT:-5001}"

if [ ! -d backend/.venv ]; then
  echo "Creating backend virtualenv…"
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q -r backend/requirements-minimal.txt
fi

if [ ! -d frontend/node_modules ]; then
  echo "Installing frontend packages…"
  (cd frontend && npm install)
fi

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "Backend  → http://localhost:${BACKEND_PORT}"
(cd backend && .venv/bin/python app.py) &

for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://localhost:${BACKEND_PORT}/api/health" && break
  sleep 0.25
done

# Pinned so it can't silently land on a port another project already serves.
FRONTEND_PORT="${FRONTEND_PORT:-5175}"
echo "Frontend → http://localhost:${FRONTEND_PORT}"
(cd frontend && npm run dev -- --port "${FRONTEND_PORT}" --strictPort) &

wait
