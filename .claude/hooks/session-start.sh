#!/bin/bash
# Installs dependencies at the start of Claude Code cloud sessions so lint,
# typecheck, tests and builds work right away.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# The pnpm version comes from "packageManager" in package.json.
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || npm install -g pnpm@10.28.0
fi

# Plain install (not frozen) so the cached container state is reused.
pnpm install --prefer-offline
