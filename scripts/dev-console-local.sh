#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONSOLE_DIR="$ROOT_DIR/console"
API_BASE_URL="${VITE_API_BASE_URL:-http://127.0.0.1:8088}"
DEV_PORT="${DEV_PORT:-5173}"

echo "Starting console dev server..."
echo "Console dir: $CONSOLE_DIR"
echo "Backend API: $API_BASE_URL"
echo "Frontend URL: http://127.0.0.1:$DEV_PORT"

cd "$CONSOLE_DIR"
VITE_API_BASE_URL="$API_BASE_URL" npm run dev -- --port "$DEV_PORT"
