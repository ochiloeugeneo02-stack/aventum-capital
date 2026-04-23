#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

# Auto-sync code to GitHub after every merge/publish
if [ -n "$GITHUB_SYNC_TOKEN" ]; then
  echo "→ Syncing to GitHub..."
  git config user.email "aventum@replit.dev" 2>/dev/null || true
  git config user.name "Aventum Capital (Replit)" 2>/dev/null || true
  REMOTE="https://ochiloeugeneo02-stack:${GITHUB_SYNC_TOKEN}@github.com/ochiloeugeneo02-stack/aventum-capital.git"
  git push "$REMOTE" main --force-with-lease 2>&1 | sed "s/${GITHUB_SYNC_TOKEN}/***REDACTED***/g" || true
  echo "✓ GitHub sync complete"
fi
