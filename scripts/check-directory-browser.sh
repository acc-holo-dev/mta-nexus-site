#!/usr/bin/env bash
set -euo pipefail

# Reuse the exact production rehearsal and its UUID resources in this shell.
# Its EXIT trap stays active until all browser checks finish, even on failure.
export NEXUS_CI_BROWSER_ONLY=true
source "$(dirname "$0")/check-production-startup.sh"
: "${NEXUS_BROWSER_TOOLS:?Browser-only tools must be installed by the CI job}"
: "${NEXUS_BROWSER_REPORT_DIR:?A CI report directory is required}"
export NEXUS_BROWSER_BASE_URL="https://$domain:8443"
export NEXUS_BROWSER_HOME="$work/browser-home"
mkdir -p "$NEXUS_BROWSER_HOME/.pki/nssdb"
# Trust only this rehearsal's CA in a disposable browser HOME, never globally.
certutil -d "sql:$NEXUS_BROWSER_HOME/.pki/nssdb" -N --empty-password
certutil -d "sql:$NEXUS_BROWSER_HOME/.pki/nssdb" -A -n nexus-directory-ci -t 'C,,' -i "$work/root.crt"
node --test scripts/tests/directory.browser.mjs

# This is deliberately separate from fixture-driven browser assertions.
# Upstream downtime is reported rather than hidden by, or made to fail, UI fixtures.
code=$("${https[@]}" -o "$work/live-directory.json" -w '%{http_code}' "https://$domain:8443/api/servers/directory?limit=1")
node --input-type=module - "$work/live-directory.json" "$code" "$NEXUS_BROWSER_REPORT_DIR" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [file, httpStatus, output] = process.argv.slice(2);
const value = JSON.parse(readFileSync(file, 'utf8'));
const result = { httpStatus, total: value.total ?? null, fetchedAt: value.fetchedAt ?? null, isStale: value.isStale ?? null };
writeFileSync(join(output, 'live-source.json'), JSON.stringify(result, null, 2));
console.log('Separate live MTA API observation:', JSON.stringify(result));
NODE
