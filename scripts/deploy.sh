#!/usr/bin/env bash
#
# BLIP production deploy — one command, repeatable.
#
# Reproduces the canonical flow:
#   build -> Vercel production -> alias blip-chagrin.vercel.app -> verify HTTP 200
#
# Run from the Vercel-linked checkout (/Users/aerdman/BLIP, or a worktree of it) so the
# .vercel/ project link resolves. Prerequisite: `vercel` CLI already authenticated.
#
# This script deliberately does NOT git commit or push — do that yourself around it so
# commit messages stay meaningful:
#   git commit ...  ->  npm run deploy  ->  git push origin main
#
set -euo pipefail

ALIAS_DOMAIN="blip-chagrin.vercel.app"

echo "==> Building..."
npm run build

echo "==> Deploying to Vercel production..."
# Vercel prints the deployment URL to stdout and progress to stderr.
DEPLOY_URL="$(npx --yes vercel@latest --prod --yes)"
echo "    Deployment: ${DEPLOY_URL}"

echo "==> Aliasing ${ALIAS_DOMAIN} -> ${DEPLOY_URL}..."
npx --yes vercel@latest alias set "${DEPLOY_URL}" "${ALIAS_DOMAIN}"

echo "==> Verifying https://${ALIAS_DOMAIN}/ ..."
STATUS="$(curl -s -o /dev/null -w '%{http_code}' "https://${ALIAS_DOMAIN}/")"
echo "    HTTP ${STATUS}  https://${ALIAS_DOMAIN}/"

if [ "${STATUS}" != "200" ]; then
  echo "!! Deploy verification FAILED: expected HTTP 200, got ${STATUS}" >&2
  exit 1
fi

echo "==> Done. Live at https://${ALIAS_DOMAIN}/ (don't forget: git push origin main)"
