#!/usr/bin/env bash
#
# Verifies that https://blip-chagrin.vercel.app is serving the current Git HEAD.
#
set -euo pipefail

ALIAS_DOMAIN="${1:-blip-chagrin.vercel.app}"
EXPECTED_COMMIT="$(git rev-parse HEAD)"
LIVE_URL="https://${ALIAS_DOMAIN}/"
TMP_HTML="/tmp/blip-production-index.html"

echo "==> Verifying ${LIVE_URL}"

STATUS="$(curl -L -s -o "${TMP_HTML}" -w '%{http_code}' "${LIVE_URL}" || true)"
echo "    HTTP ${STATUS}"

if [ "${STATUS}" != "200" ]; then
  echo "!! Production verification FAILED: expected HTTP 200 for ${LIVE_URL}, got ${STATUS}" >&2
  exit 1
fi

LIVE_COMMIT="$(node -e "const fs=require('fs'); const html=fs.readFileSync('${TMP_HTML}','utf8'); const match=html.match(/<meta name=\"blip-deploy-commit\" content=\"([^\"]+)\"/); process.stdout.write(match ? match[1] : '')")"

echo "    Live commit:     ${LIVE_COMMIT}"
echo "    Expected commit: ${EXPECTED_COMMIT}"

if [ "${LIVE_COMMIT}" != "${EXPECTED_COMMIT}" ]; then
  echo "!! Production verification FAILED: ${ALIAS_DOMAIN} is not serving current HEAD." >&2
  exit 1
fi

echo "==> Production verified: ${ALIAS_DOMAIN} is serving ${EXPECTED_COMMIT}"
