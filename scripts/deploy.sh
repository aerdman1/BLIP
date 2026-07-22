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
VERCEL_CLI_VERSION="${VERCEL_CLI_VERSION:-56.5.0}"

if [ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt 20 ] && [ -s "${HOME}/.nvm/nvm.sh" ]; then
  # Vercel CLI transitives now expect Node 20+; keep deploy output clean even if the shell defaults to Node 18.
  # shellcheck disable=SC1091
  . "${HOME}/.nvm/nvm.sh"
  nvm use --silent 20 >/dev/null
fi

VERCEL_CLI=(npx --yes "vercel@${VERCEL_CLI_VERSION}")

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
DEPLOY_LOG="$(mktemp)"
set +e
"${VERCEL_CLI[@]}" --prod --yes 2>&1 | tee "${DEPLOY_LOG}"
DEPLOY_STATUS="${PIPESTATUS[0]}"
set -e
DEPLOY_OUT="$(cat "${DEPLOY_LOG}")"
DEPLOY_URL="$(printf '%s\n' "${DEPLOY_OUT}" | grep -Eo 'https://[a-zA-Z0-9._-]+\.vercel\.app' | tail -1)"
if [ -z "${DEPLOY_URL}" ]; then
  echo "!! Could not parse a deployment URL from Vercel output:" >&2
  printf '%s\n' "${DEPLOY_OUT}" | tail -20 >&2
  exit 1
fi
if [ "${DEPLOY_STATUS}" != "0" ]; then
  echo "!! Vercel CLI exited ${DEPLOY_STATUS}, but a deployment URL was created. Inspecting it before deciding." >&2
fi
echo "    Deployment: ${DEPLOY_URL}"

echo "==> Waiting for deployment to be ready..."
"${VERCEL_CLI[@]}" inspect "${DEPLOY_URL}" --wait --timeout 5m >/dev/null

echo "==> Aliasing ${ALIAS_DOMAIN} -> ${DEPLOY_URL}..."
"${VERCEL_CLI[@]}" alias set "${DEPLOY_URL}" "${ALIAS_DOMAIN}"

bash scripts/verify-production.sh "${ALIAS_DOMAIN}" "${DEPLOY_URL}"

echo "==> Done. Live at https://${ALIAS_DOMAIN}/ (verified alias target; don't forget: git push origin main)"
