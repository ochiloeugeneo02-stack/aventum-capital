#!/bin/bash
# Manual sync — run any time to push latest code to GitHub.
# GITHUB_SYNC_TOKEN is stored in Replit Secrets.

set -e

git config user.email "aventum@replit.dev" 2>/dev/null || true
git config user.name "Aventum Capital (Replit)" 2>/dev/null || true

REMOTE="https://ochiloeugeneo02-stack:${GITHUB_SYNC_TOKEN}@github.com/ochiloeugeneo02-stack/aventum-capital.git"

git push "$REMOTE" main --force-with-lease 2>&1 | sed "s/${GITHUB_SYNC_TOKEN}/***REDACTED***/g"

echo "✓ GitHub sync complete"
