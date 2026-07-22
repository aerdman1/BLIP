#!/usr/bin/env bash
#
# Verifies that the production alias points at a ready Vercel deployment.
#
set -euo pipefail

ALIAS_DOMAIN="${1:-blip-chagrin.vercel.app}"
EXPECTED_DEPLOYMENT_URL="${2:-}"
VERCEL_CLI_VERSION="${VERCEL_CLI_VERSION:-56.5.0}"

if [ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt 20 ] && [ -s "${HOME}/.nvm/nvm.sh" ]; then
  # Vercel CLI transitives now expect Node 20+; keep verification output clean even if the shell defaults to Node 18.
  # shellcheck disable=SC1091
  . "${HOME}/.nvm/nvm.sh"
  nvm use --silent 20 >/dev/null
fi

VERCEL_CLI=(npx --yes "vercel@${VERCEL_CLI_VERSION}")

echo "==> Verifying https://${ALIAS_DOMAIN}/ via Vercel"

INSPECT_OUT="$("${VERCEL_CLI[@]}" inspect "https://${ALIAS_DOMAIN}" --format=json)"
INSPECT_JSON="$(printf '%s\n' "${INSPECT_OUT}" | sed -n '/^{/,$p')"

if [ -z "${INSPECT_JSON}" ]; then
  echo "!! Production verification FAILED: could not parse Vercel inspect JSON." >&2
  exit 1
fi

INSPECT_JSON="${INSPECT_JSON}" EXPECTED_DEPLOYMENT_URL="${EXPECTED_DEPLOYMENT_URL}" node -e '
const data = JSON.parse(process.env.INSPECT_JSON);
const expected = process.env.EXPECTED_DEPLOYMENT_URL || "";
const liveUrl = data.url || "";
console.log(`    Deployment: https://${liveUrl}`);
console.log(`    State:      ${data.readyState}`);
console.log(`    Target:     ${data.target}`);
if (data.name !== "blip" || data.readyState !== "READY" || data.target !== "production") {
  console.error("!! Production verification FAILED: alias is not a ready BLIP production deployment.");
  process.exit(1);
}
if (expected) {
  const normalized = expected.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (liveUrl !== normalized) {
    console.error(`!! Production verification FAILED: alias points to ${liveUrl}, expected ${normalized}.`);
    process.exit(1);
  }
}
'

echo "==> Production verified: ${ALIAS_DOMAIN} points at the expected ready deployment."
