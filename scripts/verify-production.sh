#!/usr/bin/env bash
#
# Verifies that https://blip-chagrin.vercel.app is serving the current Git HEAD.
#
set -euo pipefail

ALIAS_DOMAIN="${1:-blip-chagrin.vercel.app}"
EXPECTED_COMMIT="$(git rev-parse HEAD)"
VERSION_URL="https://${ALIAS_DOMAIN}/deploy-version.json"

echo "==> Verifying ${VERSION_URL}"

STATUS="$(curl -s -o /tmp/blip-deploy-version.json -w '%{http_code}' "${VERSION_URL}")"
echo "    HTTP ${STATUS}"

if [ "${STATUS}" != "200" ]; then
  echo "!! Production verification FAILED: expected HTTP 200 for ${VERSION_URL}, got ${STATUS}" >&2
  exit 1
fi

LIVE_COMMIT="$(node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('/tmp/blip-deploy-version.json','utf8')); process.stdout.write(data.commit || '')")"
LIVE_MESSAGE="$(node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('/tmp/blip-deploy-version.json','utf8')); process.stdout.write(data.message || '')")"

echo "    Live commit:     ${LIVE_COMMIT}"
echo "    Expected commit: ${EXPECTED_COMMIT}"
echo "    Live message:    ${LIVE_MESSAGE}"

if [ "${LIVE_COMMIT}" != "${EXPECTED_COMMIT}" ]; then
  echo "!! Production verification FAILED: ${ALIAS_DOMAIN} is not serving current HEAD." >&2
  exit 1
fi

echo "==> Production verified: ${ALIAS_DOMAIN} is serving ${EXPECTED_COMMIT}"
