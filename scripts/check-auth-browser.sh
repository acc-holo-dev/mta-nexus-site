#!/usr/bin/env bash
set -euo pipefail

# The production harness requires a disposable GitHub-hosted runner, default
# daemon, fresh UUID project and volumes. Its EXIT trap owns cleanup throughout.
source "$(dirname "$0")/check-production-startup.sh"
: "${NEXUS_BROWSER_TOOLS:?Browser-only tools are required}"
: "${NEXUS_BROWSER_REPORT_DIR:?A report directory is required}"
export NEXUS_BROWSER_BASE_URL="https://$domain:8443"
export NEXUS_BROWSER_HOME="$work/auth-browser-home"
mkdir -p "$NEXUS_BROWSER_HOME/.pki/nssdb"
certutil -d "sql:$NEXUS_BROWSER_HOME/.pki/nssdb" -N --empty-password
certutil -d "sql:$NEXUS_BROWSER_HOME/.pki/nssdb" -A -n nexus-auth-ci -t 'C,,' -i "$work/root.crt"
node --test scripts/tests/auth.browser.mjs

# A separate process checks the public route as well as the owner workspace.
node --test scripts/tests/private-server.browser.mjs
