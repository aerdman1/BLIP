#!/usr/bin/env bash
#
# BLIP production deploy — one command, repeatable.
#
# Reproduces the canonical flow:
#   build -> Vercel production -> alias blip-chagrin.vercel.app -> verify live commit
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
EXPECTED_PROJECT="blip"

# Guard: never deploy unless THIS checkout is linked to the canonical "blip" project.
# (Running from a worktree can auto-create a stray project named after the directory.)
LINKED_PROJECT="$(sed -n 's/.*"projectName":"\([^"]*\)".*/\1/p' .vercel/project.json 2>/dev/null || true)"
if [ "${LINKED_PROJECT}" != "${EXPECTED_PROJECT}" ]; then
  echo "!! Refusing to deploy: .vercel is linked to '${LINKED_PROJECT:-<none>}', expected '${EXPECTED_PROJECT}'." >&2
  echo "   Fix: copy /Users/aerdman/BLIP/.vercel/project.json here, or deploy from /Users/aerdman/BLIP." >&2
  exit 1
fi

echo "==> Building..."
npm run build

echo "==> Deploying to Vercel production..."
# Capture all output, then extract the deployment URL robustly (last *.vercel.app URL seen).
DEPLOY_OUT="$(npx --yes vercel@latest --prod --yes 2>&1)"
DEPLOY_URL="$(printf '%s\n' "${DEPLOY_OUT}" | grep -Eo 'https://[a-zA-Z0-9._-]+\.vercel\.app' | tail -1)"
if [ -z "${DEPLOY_URL}" ]; then
  echo "!! Could not parse a deployment URL from Vercel output:" >&2
  printf '%s\n' "${DEPLOY_OUT}" | tail -20 >&2
  exit 1
fi
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

bash scripts/verify-production.sh "${ALIAS_DOMAIN}"

echo "==> Done. Live at https://${ALIAS_DOMAIN}/ (verified current Git HEAD; don't forget: git push origin main)"
