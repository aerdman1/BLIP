#!/usr/bin/env bash
#
# One-command production shipping for committed BLIP changes:
#   sync -> check -> push GitHub -> deploy Vercel -> verify blip-chagrin
#
set -euo pipefail

EXPECTED_BRANCH="main"

BRANCH="$(git branch --show-current)"
if [ "${BRANCH}" != "${EXPECTED_BRANCH}" ]; then
  echo "!! Refusing to ship from branch '${BRANCH}'. Expected '${EXPECTED_BRANCH}'." >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "!! Refusing to ship with uncommitted changes. Commit intentionally first." >&2
  git status --short
  exit 1
fi

echo "==> Syncing ${EXPECTED_BRANCH} with origin..."
git fetch origin
git pull --ff-only origin "${EXPECTED_BRANCH}"

echo "==> Checking..."
npm run typecheck
npm run build

echo "==> Pushing GitHub..."
git push origin "${EXPECTED_BRANCH}"

echo "==> Deploying Vercel production..."
npm run deploy

echo "==> Ship complete: https://blip-chagrin.vercel.app/"
