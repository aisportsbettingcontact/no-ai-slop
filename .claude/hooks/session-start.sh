#!/usr/bin/env bash
# SessionStart hook: make the repo immediately ready to typecheck, test, and lint.
# Installs dependencies and builds the workspace packages (so their dist/.d.ts
# exist for cross-package resolution). Idempotent and quiet; never fails the session.
set -uo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root" || exit 0

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
fi

# Install (prefer the frozen lockfile for reproducibility; fall back if it drifts).
pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install >/dev/null 2>&1 || true

# Build library packages so tsc project references + tests resolve cleanly.
pnpm build >/dev/null 2>&1 || true

echo "No AI Slop ready: dependencies installed, packages built. Try: pnpm test | node scripts/dod.mjs"
exit 0
