#!/usr/bin/env bash
set -euo pipefail

# Destructive cleanup is allowed only on a disposable GitHub-hosted runner.
[[ ${GITHUB_ACTIONS:-} == true && ${RUNNER_ENVIRONMENT:-} == github-hosted ]] || {
  echo 'Refusing: this smoke test requires a disposable GitHub-hosted runner.' >&2; exit 1;
}
[[ -z ${DOCKER_HOST:-} && -z ${DOCKER_CONTEXT:-} && $(docker context show) == default ]] || {
  echo 'Refusing a non-default or remote Docker daemon.' >&2; exit 1;
}
cd "$(dirname "$0")/.."
umask 077
work=$(mktemp -d)
project="nexus-prod-ci-$(node -p 'require("node:crypto").randomUUID()')"
image="${project}:candidate"
domain=nexus-ci.test
password=$(openssl rand -hex 24)
secret=$(openssl rand -hex 32)
echo "::add-mask::$password"
echo "::add-mask::$secret"
export NEXUS_CI_CADDYFILE="$work/Caddyfile"
node --input-type=module <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
import { localCertificateConfig } from './scripts/production-smoke-contract.mjs';
writeFileSync(process.env.NEXUS_CI_CADDYFILE, localCertificateConfig(readFileSync('deploy/Caddyfile', 'utf8')));
NODE
# Explicit test values, no repository .env or inherited application credentials.
pc=(env -i "PATH=$PATH" "HOME=$HOME" COMPOSE_DISABLE_ENV_FILE=true
  "DOMAIN=$domain" ACME_EMAIL=ci@nexus-ci.test POSTGRES_USER=nexus POSTGRES_DB=mta_nexus
  "POSTGRES_PASSWORD=$password" "AUTH_SECRET=$secret" "NEXUS_CI_IMAGE=$image"
  "NEXUS_CI_CADDYFILE=$NEXUS_CI_CADDYFILE"
  docker compose --env-file /dev/null -p "$project"
  -f compose.production.yaml -f compose.production-ci.yaml)
owned=0
cleanup() {
  status=$?
  trap - EXIT
  if [[ $owned == 1 ]]; then
    if [[ $status != 0 ]]; then
      "${pc[@]}" ps --all || true
      "${pc[@]}" logs --no-color --tail 60 || true
    fi
    "${pc[@]}" down --volumes --remove-orphans --timeout 15 || status=1
    [[ -z $(docker volume ls -q --filter "label=com.docker.compose.project=$project") ]] || status=1
  fi
  rm -rf -- "$work"
  exit "$status"
}
trap cleanup EXIT
"${pc[@]}" config --format json > "$work/compose.json"
node --input-type=module - "$work/compose.json" "$project" "$NEXUS_CI_CADDYFILE" <<'NODE'
import { readFileSync } from 'node:fs';
import { assertIsolatedProduction } from './scripts/production-smoke-contract.mjs';
assertIsolatedProduction(JSON.parse(readFileSync(process.argv[2], 'utf8')), process.argv[3], process.argv[4]);
NODE
[[ -z $(docker ps -aq --filter "label=com.docker.compose.project=$project") ]]
[[ -z $(docker volume ls -q --filter "label=com.docker.compose.project=$project") ]]
owned=1
# Adapt the ORIGINAL production file first: do not hide missing environment wiring.
"${pc[@]}" run --rm -T --no-deps --entrypoint caddy caddy adapt --config /etc/caddy/ProductionCaddyfile --adapter caddyfile > "$work/original.json"
"${pc[@]}" run --rm -T --no-deps --entrypoint caddy caddy adapt --config /etc/caddy/Caddyfile --adapter caddyfile > "$work/internal.json"
node --input-type=module - "$work/internal.json" <<'NODE'
import { readFileSync } from 'node:fs';
import { assertInternalIssuer } from './scripts/production-smoke-contract.mjs';
assertInternalIssuer(JSON.parse(readFileSync(process.argv[2], 'utf8')));
NODE
"${pc[@]}" build app
"${pc[@]}" up --detach --wait --wait-timeout 600 --no-build
app=$("${pc[@]}" ps -q app)
caddy=$("${pc[@]}" ps -q caddy)
[[ $("${pc[@]}" exec -T app id -u) != 0 ]]
"${pc[@]}" exec -T app node --input-type=module -e "import assert from 'node:assert/strict'; assert.equal(process.env.NODE_ENV, 'production'); assert.equal(process.env.BUILD_SCANNER, 'clamav');"
"${pc[@]}" exec -T app node scripts/check-local-readiness.mjs
for service in app postgres clamav; do
  id=$("${pc[@]}" ps -q "$service")
  [[ -n $id && -z $(docker port "$id") ]]
done
[[ $(docker port "$caddy" 443/tcp) == 127.0.0.1:8443 ]]
[[ $(docker port "$caddy" 80/tcp) == 127.0.0.1:8080 ]]
for attempt in $(seq 1 30); do
  if docker cp "$caddy:/data/caddy/pki/authorities/local/root.crt" "$work/root.crt" 2>/dev/null; then break; fi
  sleep 1
done
test -s "$work/root.crt"
https=(curl --silent --show-error --noproxy '*' --max-time 30
  --cacert "$work/root.crt" --resolve "$domain:8443:127.0.0.1")
"${https[@]}" --fail "https://$domain:8443/api/health" > "$work/health.json"
node --input-type=module - "$work/health.json" <<'NODE'
import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const value = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(value.status, 'ok'); assert.equal(value.database, 'reachable');
NODE
"${https[@]}" --fail "https://$domain:8443/" > "$work/home.html"
grep -qi '<html' "$work/home.html"
redirect=$(curl --silent --show-error --noproxy '*' --max-time 10 --resolve "$domain:8080:127.0.0.1" -o /dev/null -w '%{http_code} %{redirect_url}' "http://$domain:8080/")
[[ $redirect == "308 https://$domain"* ]]
echo 'PASS: production image, trusted test TLS, HTTP redirect, proxy, database, writable uploads and private ports'

sql() { "${pc[@]}" exec -T postgres psql -X -v ON_ERROR_STOP=1 -U nexus -d mta_nexus -Atc "$1"; }
[[ $(sql 'SELECT count(*) FROM drizzle.__drizzle_migrations') -gt 0 ]]
sql "CREATE TABLE beta003_probe (id integer PRIMARY KEY, value text); INSERT INTO beta003_probe VALUES (1, 'retained');"
"${pc[@]}" exec -T app node --input-type=module -e "import {writeFileSync} from 'node:fs'; writeFileSync('/data/uploads/beta003-probe', 'retained', {flag:'wx'});"
image_before=$(docker inspect --format '{{.Image}}' "$app")
"${pc[@]}" up --detach --no-deps --force-recreate --no-build --wait --wait-timeout 180 app
after=$("${pc[@]}" ps -q app)
[[ -n $after && $after != "$app" && $(docker inspect --format '{{.Image}}' "$after") == "$image_before" ]]
"${pc[@]}" exec -T app node scripts/check-local-readiness.mjs
"${pc[@]}" exec -T app node --input-type=module -e "import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs'; assert.equal(readFileSync('/data/uploads/beta003-probe', 'utf8'), 'retained');"
[[ $(sql 'SELECT value FROM beta003_probe WHERE id=1') == retained ]]
"${https[@]}" --fail --retry 10 --retry-all-errors --retry-delay 1 "https://$domain:8443/api/health" > /dev/null
echo 'PASS: production app replaced using the same image; database and uploaded file retained'

# These one-off containers use the real production startup command, not a mock.
expect_refusal() {
  label=$1; value=$2
  set +e
  timeout 45s "${pc[@]}" run --rm -T --no-deps -e "$value" app > "$work/refusal.log" 2>&1
  code=$?
  set -e
  [[ $code != 0 && $code != 124 && $code != 137 ]] || {
    echo "FAIL: $label did not exit promptly with failure" >&2; return 1;
  }
  grep -Eq 'Invalid configuration parameters|Migration error:' "$work/refusal.log"
  echo "PASS: production startup rejects $label"
}
expect_refusal 'empty auth secret' 'AUTH_SECRET='
expect_refusal 'HTTP application URL' 'NEXT_PUBLIC_APP_URL=http://nexus-ci.test'
expect_refusal 'disabled scanner' 'BUILD_SCANNER=disabled'
expect_refusal 'unavailable migration database' "DATABASE_URL=postgres://nexus:$password@postgres:5432/nonexistent_beta003"

# Failures of dependencies must be visible, and recovery must use existing data.
"${pc[@]}" stop postgres
code=$("${https[@]}" -o "$work/unavailable.json" -w '%{http_code}' "https://$domain:8443/api/health")
[[ $code == 503 ]]
"${pc[@]}" start postgres
"${pc[@]}" up --detach --no-build --wait --wait-timeout 180
"${https[@]}" --fail "https://$domain:8443/api/health" > /dev/null
[[ $(sql 'SELECT value FROM beta003_probe WHERE id=1') == retained ]]
echo 'PASS: database outage returns 503 through HTTPS proxy; service recovers without losing the probe'
{
  echo '## BETA-003 production startup'
  echo "Commit: ${GITHUB_SHA:-unknown}"
  echo "Application image: $image_before"
  echo 'PASS: HTTPS with an explicitly trusted disposable internal CA; production proxy directives retained.'
  echo 'PASS: migrations, non-root app, private ports, read/write storage, replacement and retained probes.'
  echo 'PASS: rejected invalid secret, HTTP URL, disabled scanner and failing migration; database 503 and recovery.'
  echo 'Not covered: public ACME/DNS, browser journeys, malware verdicts, existing databases or backup restore.'
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
