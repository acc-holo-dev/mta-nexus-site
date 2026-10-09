#!/usr/bin/env bash
set -euo pipefail
export NEXUS_CI_BROWSER_ONLY=true
source "$(dirname "$0")/check-production-startup.sh"
export NEXUS_BROWSER_BASE_URL="https://$domain:8443"
export NEXUS_BROWSER_HOME="$work/smoke-browser-home"
mkdir -p "$NEXUS_BROWSER_HOME/.pki/nssdb" "$NEXUS_BROWSER_REPORT_DIR"
certutil -d "sql:$NEXUS_BROWSER_HOME/.pki/nssdb" -N --empty-password
certutil -d "sql:$NEXUS_BROWSER_HOME/.pki/nssdb" -A -n nexus-smoke-ci -t 'C,,' -i "$work/root.crt"
"$NEXUS_BROWSER_TOOLS/node_modules/.bin/playwright" test \
  --config=playwright.ci.config.mjs scripts/tests/fast-smoke.playwright.mjs \
  scripts/tests/directory-smoke.playwright.mjs scripts/tests/accessibility-smoke.playwright.mjs
