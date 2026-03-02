#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT"

echo "[check] Yggdrasil: validate"
yg validate

echo "[check] Yggdrasil: drift"
yg drift

echo "[check] API: typecheck"
npm run typecheck -w @expense-tracker/api

echo "[check] Web: build"
npm run build -w @expense-tracker/web

echo "[check] All passed"
