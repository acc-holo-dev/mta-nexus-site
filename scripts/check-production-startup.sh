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
project="nexus-prod-ci-$(node -p 'require("node:crypto").randomUUID()')"
browser_only="${NEXUS_CI_BROWSER_ONLY:-false}"
case "$browser_only" in true|false) ;; *) echo 'NEXUS_CI_BROWSER_ONLY must be true or false' >&2; exit 1 ;; esac
image="${project}:candidate"
if [[ -n ${NEXUS_CI_PREBUILT_IMAGE:-} ]]; then
  image=$(bash scripts/validate-ci-image.sh)
elif [[ $browser_only == true ]]; then
  echo 'Browser jobs require NEXUS_CI_PREBUILT_IMAGE to avoid rebuilding the production image.' >&2
  exit 1
fi
work=$(mktemp -d)
domain=nexus-ci.test
password=$(openssl rand -hex 24)
secret=$(openssl rand -hex 32)
proxy_secret=$(openssl rand -hex 32)
mail_key=$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url"))')
abuse_key=$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url"))')
echo "::add-mask::$password"
echo "::add-mask::$secret"
echo "::add-mask::$proxy_secret"
echo "::add-mask::$mail_key"
echo "::add-mask::$abuse_key"
export NEXUS_CI_CADDYFILE="$work/Caddyfile"
node --input-type=module <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
import {
  assertProductionUploadBodyLimit,
  localCertificateConfig,
} from './scripts/production-smoke-contract.mjs';
const productionCaddy = readFileSync('deploy/Caddyfile', 'utf8');
assertProductionUploadBodyLimit(productionCaddy);
writeFileSync(
  process.env.NEXUS_CI_CADDYFILE,
  localCertificateConfig(productionCaddy),
);
NODE
# Explicit test values, no repository .env or inherited application credentials.
pc=(env -i "PATH=$PATH" "HOME=$HOME" COMPOSE_DISABLE_ENV_FILE=true
  "DOMAIN=$domain" ACME_EMAIL=ci@nexus-ci.test POSTGRES_USER=nexus POSTGRES_DB=mta_nexus
  "POSTGRES_PASSWORD=$password" "AUTH_SECRET=$secret" "TRUSTED_PROXY_SECRET=$proxy_secret" "NEXUS_CI_IMAGE=$image"
  "NEXUS_CI_ACCOUNT_MAIL_KEY=$mail_key" "NEXUS_CI_ACCOUNT_RECOVERY_ABUSE_KEY=$abuse_key"
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
phase=compose-validation
# Never print BASH_COMMAND or enable xtrace: commands can contain disposable credentials.
trap 'printf "FAIL: production smoke phase=%s line=%s\n" "$phase" "$LINENO" >&2' ERR
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
phase=image-build
if [[ -z ${NEXUS_CI_PREBUILT_IMAGE:-} ]]; then
  "${pc[@]}" build app
fi
phase=stack-start
"${pc[@]}" up --detach --wait --wait-timeout 600 --no-build
phase=runtime-layout
app=$("${pc[@]}" ps -q app)
caddy=$("${pc[@]}" ps -q caddy)
push_worker=$("${pc[@]}" ps -q push-worker)
[[ -n $push_worker ]]
[[ $("${pc[@]}" exec -T app id -u) != 0 ]]
[[ $("${pc[@]}" exec -T push-worker id -u) != 0 ]]
[[ $("${pc[@]}" exec -T license-worker id -u) != 0 ]]
[[ $("${pc[@]}" exec -T resource-release-worker id -u) != 0 ]]
[[ "$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$push_worker")" == true ]]
[[ "$(docker inspect --format '{{.HostConfig.PidsLimit}}' "$push_worker")" == 128 ]]
[[ "$(docker inspect --format '{{json .HostConfig.CapDrop}}' "$push_worker")" == '["ALL"]' ]]
[[ "$(docker inspect --format '{{json .HostConfig.SecurityOpt}}' "$push_worker")" == '["no-new-privileges:true"]' ]]
"${pc[@]}" exec -T app node --input-type=module -e "import assert from 'node:assert/strict'; assert.equal(process.env.NODE_ENV, 'production'); assert.equal(process.env.HOSTNAME, '0.0.0.0'); assert.equal(process.env.BUILD_SCANNER, 'clamav');"
"${pc[@]}" exec -T app test -f /app/apps/web/server.js
"${pc[@]}" exec -T app test -f /app/packages/db/src/migrate.ts
"${pc[@]}" exec -T app test -d /app/packages/db/migrations
"${pc[@]}" exec -T app sh -c 'test -n "$(find /app/packages/db/migrations -type f -name "*.sql" -print -quit)"'
"${pc[@]}" exec -T app test -f /app/packages/db/node_modules/tsx/package.json
"${pc[@]}" exec -T push-worker test -f /app/scripts/web-push-worker-health-state.mjs
"${pc[@]}" exec -T push-worker test -f /app/scripts/check-web-push-worker-health.mjs
"${pc[@]}" exec -T push-worker test -f /app/scripts/check-web-push-worker-queue.mjs
"${pc[@]}" exec -T push-worker sh -c 'test -w /tmp && test ! -w /app'
if "${pc[@]}" exec -T app sh -c 'command -v pnpm >/dev/null 2>&1'; then
  echo 'FAIL: production runtime unexpectedly contains pnpm' >&2
  exit 1
fi
"${pc[@]}" exec -T app node scripts/check-local-readiness.mjs
"${pc[@]}" exec -T push-worker node /app/scripts/check-web-push-worker-health.mjs
"${pc[@]}" exec -T push-worker node /app/scripts/check-web-push-worker-queue.mjs > "$work/push-queue.json"
node --input-type=module - "$work/push-queue.json" <<'NODE'
import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const value = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(value.status, 'ok');
assert.equal(value.configured, false);
assert.equal(value.queuePending, 0);
NODE
if [[ $browser_only == false ]]; then
phase=push-worker-supervisor-recovery
app_before=$("${pc[@]}" ps -q app)
postgres_before=$("${pc[@]}" ps -q postgres)
worker_before=$("${pc[@]}" ps -q push-worker)
restart_before=$(docker inspect --format '{{.RestartCount}}' "$worker_before")
started_before=$(docker inspect --format '{{.State.StartedAt}}' "$worker_before")
# docker kill marks a manual stop and suppresses unless-stopped restart.
# Signal the container's host PID (init) to simulate a process crash, matching
# the mail-worker rehearsal. Do not compare in-container health snapshot PIDs:
# the PID namespace reuses the same numbers across supervised restarts.
worker_pid=$(docker inspect --format '{{.State.Pid}}' "$worker_before")
[[ $worker_pid =~ ^[0-9]+$ && $worker_pid -gt 1 ]]
sudo kill -KILL "$worker_pid"

recovered=0
for attempt in $(seq 1 120); do
  sleep 0.25
  worker_now=$("${pc[@]}" ps -q push-worker 2>/dev/null || true)
  [[ -n $worker_now ]] || continue
  running=$(docker inspect --format '{{.State.Running}}' "$worker_now" 2>/dev/null || true)
  [[ $running == true ]] || continue
  restart_now=$(docker inspect --format '{{.RestartCount}}' "$worker_now" 2>/dev/null || echo 0)
  if [[ $restart_now -le $restart_before ]]; then continue; fi
  started_now=$(docker inspect --format '{{.State.StartedAt}}' "$worker_now" 2>/dev/null || true)
  [[ -n $started_now && $started_now != "$started_before" ]] || continue
  if "${pc[@]}" exec -T push-worker node /app/scripts/check-web-push-worker-health.mjs >/dev/null 2>&1; then
    recovered=1
    break
  fi
done
[[ $recovered == 1 ]]
[[ $("${pc[@]}" ps -q app) == "$app_before" ]]
[[ $("${pc[@]}" ps -q postgres) == "$postgres_before" ]]
"${pc[@]}" exec -T push-worker node /app/scripts/check-web-push-worker-queue.mjs > "$work/push-queue-after-restart.json"
node --input-type=module - "$work/push-queue-after-restart.json" <<'NODE'
import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const value = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(value.status, 'ok');
assert.equal(value.queuePending, 0);
assert.equal(value.queueDue, 0);
assert.equal(value.queueLeased, 0);
NODE
echo 'PASS: push-worker process crash is supervised, restarted and healthy without restarting app/postgres'
fi
phase=private-ports
for service in app push-worker license-worker resource-release-worker postgres clamav; do
  id=$("${pc[@]}" ps -q "$service")
  [[ -n $id && -z $(docker port "$id") ]]
done
[[ $(docker port "$caddy" 443/tcp) == 127.0.0.1:8443 ]]
[[ $(docker port "$caddy" 80/tcp) == 127.0.0.1:8080 ]]
phase=test-ca
for attempt in $(seq 1 30); do
  if docker cp "$caddy:/data/caddy/pki/authorities/local/root.crt" "$work/root.crt" 2>/dev/null; then break; fi
  sleep 1
done
test -s "$work/root.crt"
if [[ $browser_only == true ]]; then
  if ! getent ahostsv4 "$domain" 2>/dev/null | awk '{print $1}' | grep -Fxq '127.0.0.1'; then
    printf '127.0.0.1\t%s\n' "$domain" | sudo tee -a /etc/hosts > /dev/null
  fi
  getent ahostsv4 "$domain" | awk '{print $1}' | grep -Fxq '127.0.0.1'
  export NODE_EXTRA_CA_CERTS="$work/root.crt"
fi
https=(curl --silent --show-error --noproxy '*' --max-time 30
  --cacert "$work/root.crt" --resolve "$domain:8443:127.0.0.1")
phase=https-health
"${https[@]}" --fail "https://$domain:8443/api/health" > "$work/health.json"
node --input-type=module - "$work/health.json" <<'NODE'
import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const value = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(value.status, 'ok'); assert.equal(value.database, 'reachable');
NODE
phase=https-home
"${https[@]}" --fail "https://$domain:8443/" > "$work/home.html"
grep -qi '<html' "$work/home.html"

phase=offline-cache-policy
"${https[@]}" --fail --dump-header "$work/offline-guest.headers" \
  "https://$domain:8443/privacy" -o "$work/offline-guest.html"
grep -qi '^x-nexus-offline-cache: public-readonly-v1' "$work/offline-guest.headers"
grep -qi '^vary:.*cookie' "$work/offline-guest.headers"
"${https[@]}" --fail --dump-header "$work/offline-session.headers" \
  -H 'Cookie: nexus_session=invalid-smoke-token; nexus_locale=en' \
  "https://$domain:8443/privacy" -o "$work/offline-session.html"
if grep -qi '^x-nexus-offline-cache:' "$work/offline-session.headers"; then
  echo 'FAIL: session-bearing public page was marked for offline document caching' >&2
  exit 1
fi

# The shared SQL helper remains available to browser fixtures in light mode.
sql() { "${pc[@]}" exec -T postgres psql -X -v ON_ERROR_STOP=1 -U nexus -d mta_nexus -Atc "$1"; }
[[ $(sql 'SELECT count(*) FROM drizzle.__drizzle_migrations') -gt 0 ]]
image_before=$(docker inspect --format '{{.Image}}' "$app")

if [[ $browser_only == false ]]; then
# The proxy must reject a request one byte above the 65 MiB upload envelope
# before the application can parse or buffer it.
phase=proxy-body-limit
proxy_upload_limit=$((65 * 1024 * 1024))
truncate -s $((proxy_upload_limit + 1)) "$work/oversized-request.bin"
oversized_code=$("${https[@]}" \
  -H 'Content-Type: application/octet-stream' \
  -H 'Expect: 100-continue' \
  --data-binary @"$work/oversized-request.bin" \
  -o /dev/null \
  -w '%{http_code}' \
  "https://$domain:8443/api/health")
[[ $oversized_code == 413 ]] || { echo "FAIL: oversized request expected HTTP 413, got $oversized_code" >&2; exit 1; }
# At the exact ceiling the proxy must let the upstream reject unsupported POST.
truncate -s "$proxy_upload_limit" "$work/oversized-request.bin"
at_limit_code=$("${https[@]}" \
  -H 'Content-Type: application/octet-stream' \
  -H 'Expect: 100-continue' \
  --data-binary @"$work/oversized-request.bin" \
  -o /dev/null -w '%{http_code}' "https://$domain:8443/api/health")
[[ $at_limit_code == 405 ]] || { echo "FAIL: exact-limit health POST expected HTTP 405, got $at_limit_code" >&2; exit 1; }
rm -f -- "$work/oversized-request.bin"
fi

phase=http-redirect
redirect=$(curl --silent --show-error --noproxy '*' --max-time 10 --resolve "$domain:8080:127.0.0.1" -o /dev/null -w '%{http_code} %{redirect_url}' "http://$domain:8080/")
[[ $redirect == "308 https://$domain"* ]]
echo 'PASS: production image, trusted test TLS, HTTP redirect, database, writable uploads and private ports'

if [[ $browser_only == false ]]; then
phase=persistence
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
phase=startup-refusals
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
phase=database-recovery
"${pc[@]}" stop postgres
code=$("${https[@]}" -o "$work/unavailable.json" -w '%{http_code}' "https://$domain:8443/api/health")
[[ $code == 503 ]]
"${pc[@]}" start postgres
"${pc[@]}" up --detach --no-build --wait --wait-timeout 180
"${https[@]}" --fail "https://$domain:8443/api/health" > /dev/null
[[ $(sql 'SELECT value FROM beta003_probe WHERE id=1') == retained ]]
echo 'PASS: database outage returns 503 through HTTPS proxy; service recovers without losing the probe'
fi
{
  echo '## BETA-003 production startup'
  echo "Commit: ${GITHUB_SHA:-unknown}"
  echo "Application image: $image_before"
  echo 'PASS: HTTPS with an explicitly trusted disposable internal CA; production proxy directives retained.'
  echo 'PASS: standalone HTTP runtime, deployed migration runtime, no runtime pnpm, non-root app, private ports and writable storage.'
  if [[ $browser_only == false ]]; then
    echo 'PASS: production Caddy body boundary, replacement and retained probes.'
    echo 'PASS: push-worker process crash is supervised and recovers health without restarting app/postgres.'
    echo 'PASS: rejected invalid secret, HTTP URL, disabled scanner and failing migration; database 503 and recovery.'
  else
    echo 'Browser-only startup: infrastructure failure rehearsals are delegated to the production infrastructure job.'
  fi
  echo 'Not covered: public ACME/DNS, browser journeys, malware verdicts, existing databases or backup restore.'
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
phase=browser-acceptance
