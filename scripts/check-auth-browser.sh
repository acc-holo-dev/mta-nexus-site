#!/usr/bin/env bash
set -euo pipefail

suite="${NEXUS_ACCOUNT_SUITE:-account}"
case "$suite" in account|password) ;; *) echo 'Unknown account test suite' >&2; exit 2 ;; esac
# Every matrix job receives its own fresh hosted runner, UUID project and volumes.
# The production harness retains its cleanup trap throughout the browser checks.
export NEXUS_CI_BROWSER_ONLY=true
source "$(dirname "$0")/check-production-startup.sh"
: "${NEXUS_BROWSER_TOOLS:?Browser-only tools are required}"
: "${NEXUS_BROWSER_REPORT_DIR:?A report directory is required}"
export NEXUS_BROWSER_BASE_URL="https://$domain:8443"
export NEXUS_BROWSER_HOME="$work/auth-browser-home"
export NEXUS_BROWSER_APP_CONTAINER="$("${pc[@]}" ps -q app)"
test -n "$NEXUS_BROWSER_APP_CONTAINER"
mkdir -p "$NEXUS_BROWSER_HOME/.pki/nssdb"
certutil -d "sql:$NEXUS_BROWSER_HOME/.pki/nssdb" -N --empty-password
certutil -d "sql:$NEXUS_BROWSER_HOME/.pki/nssdb" -A -n nexus-auth-ci -t 'C,,' -i "$work/root.crt"
if [ "$suite" = password ]; then
  node --test scripts/tests/password-sessions.browser.mjs
else
  node --test scripts/tests/auth.browser.mjs
  node --test scripts/tests/private-server.browser.mjs
fi
