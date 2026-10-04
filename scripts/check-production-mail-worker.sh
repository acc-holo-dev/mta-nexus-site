#!/usr/bin/env bash
set -Eeuo pipefail

phase=bootstrap
on_error() {
  code=$?
  printf 'D5 FAIL: phase=%s line=%s exit=%s\n' "$phase" "${BASH_LINENO[0]:-unknown}" "$code" >&2
  exit "$code"
}
trap on_error ERR

phase=runner-guard
[[ ${GITHUB_ACTIONS:-} == true && ${RUNNER_ENVIRONMENT:-} == github-hosted ]] || {
  echo 'Refusing: D5 mail-worker acceptance requires a disposable GitHub-hosted runner.' >&2
  exit 1
}
[[ -z ${DOCKER_HOST:-} && -z ${DOCKER_CONTEXT:-} && $(docker context show) == default ]] || {
  echo 'Refusing a non-default or remote Docker daemon.' >&2
  exit 1
}
cd "$(dirname "$0")/.."

phase=synthetic-secrets
image=${NEXUS_D5_IMAGE:-mta-nexus:ci}
receiver="nexus-smtp-${GITHUB_RUN_ID:?}-${GITHUB_RUN_ATTEMPT:?}"
worker="nexus-mail-worker-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
mail_key=$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url"))')
previous_mail_key=$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url"))')
abuse_key=$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url"))')
test_password="D5-$(openssl rand -hex 24)"
for value in "$mail_key" "$previous_mail_key" "$abuse_key" "$test_password"; do echo "::add-mask::$value"; done
cleanup() { docker rm -f "$worker" >/dev/null 2>&1 || true; }
trap cleanup EXIT

export NEXUS_MAIL_IMAGE="$image"
export DOMAIN=nexus-ci.test
export ACME_EMAIL=ci@nexus-ci.test
export POSTGRES_USER=nexus
export POSTGRES_PASSWORD=nexus_test_secret
export POSTGRES_DB=nexus_mail_acceptance
# Used only when rendering the full Compose config; never passed to the worker.
export TRUSTED_PROXY_SECRET=disposable-mail-worker-proxy-config-only
export ACCOUNT_MAIL_KEY_ID=ci
export ACCOUNT_MAIL_KEY="$mail_key"
export ACCOUNT_RECOVERY_ABUSE_KEY="$abuse_key"
export ACCOUNT_MAIL_PREVIOUS_KEY_ID=ci-previous
export ACCOUNT_MAIL_PREVIOUS_KEY="$previous_mail_key"
export ACCOUNT_MAIL_APP_URL=https://nexus-mta.test
export ACCOUNT_MAIL_SMTP_HOST=localhost
export ACCOUNT_MAIL_SMTP_PORT=2465
export ACCOUNT_MAIL_SMTP_SERVERNAME=localhost
export ACCOUNT_MAIL_SMTP_FROM=no-reply@nexus-mta.test
export ACCOUNT_MAIL_SMTP_USERNAME=nexus-ci-user
export ACCOUNT_MAIL_SMTP_PASSWORD=nexus-ci-password
export COMPOSE_DISABLE_ENV_FILE=true

phase=compose-contract
echo 'D5 phase: compose contract'
docker compose --env-file /dev/null \
  -f compose.production.yaml -f compose.recovery.yaml -f compose.mail-worker.yaml \
  config --format json > /tmp/nexus-d5-worker-compose.json
node scripts/tests/mail-worker-compose.node-test.mjs /tmp/nexus-d5-worker-compose.json
node scripts/tests/recovery-compose.node-test.mjs /tmp/nexus-d5-worker-compose.json

# A fresh database prevents unrelated test ciphertext/key IDs from contaminating
# the fail-closed key-coverage check. Never delete rows from the shared test DB.
phase=isolated-database
echo 'D5 phase: create isolated acceptance database'
pnpm --filter @nexus/db exec node --input-type=module -e '
  import postgres from "postgres";
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try { await sql.unsafe("CREATE DATABASE nexus_mail_acceptance"); }
  finally { await sql.end(); }
'
export DATABASE_URL=postgres://nexus:nexus_test_secret@localhost:5432/nexus_mail_acceptance
pnpm --filter @nexus/db migrate

phase=seed-synthetic-mail
echo 'D5 phase: seed synthetic mail'
seed=$(NEXUS_D5_MAIL_SEED=true NEXUS_D5_TEST_PASSWORD="$test_password" \
  ACCOUNT_RECOVERY_ABUSE_KEY="$abuse_key" \
  ACCOUNT_MAIL_KEY_ID=ci-previous ACCOUNT_MAIL_KEY="$previous_mail_key" \
  node --import tsx packages/db/scripts/seed-account-mail-ci.ts)
challenge=$(node -e 'const x=JSON.parse(process.argv[1]); if(!/^ach_/.test(x.challengeId)) process.exit(1); process.stdout.write(x.challengeId)' "$seed")
mail=$(node -e 'const x=JSON.parse(process.argv[1]); if(!/^ame_/.test(x.mailId)) process.exit(1); process.stdout.write(x.mailId)' "$seed")

phase=resolve-tls-receiver
echo 'D5 phase: resolve closed TLS receiver'
smtp_host=$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$receiver")
test -n "$smtp_host"
ca=$(cat /tmp/nexus-smtp-ci/cert.pem)

start_worker() {
  docker run --detach --name "$worker" \
    --restart unless-stopped \
    --add-host host.docker.internal:host-gateway \
    --env NODE_ENV=production \
    --env DATABASE_URL=postgres://nexus:nexus_test_secret@host.docker.internal:5432/nexus_mail_acceptance \
    --env ACCOUNT_MAIL_KEY_ID=ci \
    --env ACCOUNT_MAIL_KEY="$mail_key" \
    --env ACCOUNT_MAIL_PREVIOUS_KEY_ID=ci-previous \
    --env ACCOUNT_MAIL_PREVIOUS_KEY="$previous_mail_key" \
    --env ACCOUNT_MAIL_APP_URL=https://nexus-mta.test \
    --env ACCOUNT_MAIL_SMTP_HOST="$smtp_host" \
    --env ACCOUNT_MAIL_SMTP_PORT=2465 \
    --env ACCOUNT_MAIL_SMTP_SERVERNAME=localhost \
    --env ACCOUNT_MAIL_SMTP_FROM=no-reply@nexus-mta.test \
    --env ACCOUNT_MAIL_SMTP_USERNAME=nexus-ci-user \
    --env ACCOUNT_MAIL_SMTP_PASSWORD=nexus-ci-password \
    --env ACCOUNT_MAIL_SMTP_CA="$ca" \
    --env ACCOUNT_MAIL_SMTP_TIMEOUT_MS=1000 \
    --env ACCOUNT_MAIL_BATCH_SIZE=2 \
    --env ACCOUNT_MAIL_POLL_INTERVAL_MS=60000 \
    "$image" sh -c 'cd /app/packages/db && exec node --import tsx scripts/run-account-mail-dispatcher.ts --ready' >/dev/null
}

wait_ready() {
  for attempt in $(seq 1 100); do
    if docker logs "$worker" 2>&1 | grep -q '"status":"ready"'; then return 0; fi
    docker inspect --format '{{.State.Running}}' "$worker" 2>/dev/null | grep -qx true || break
    sleep 0.1
  done
  docker logs "$worker" 2>&1 || true
  return 1
}

phase=start-worker
echo 'D5 phase: start production-image worker'
start_worker
wait_ready
phase=inspect-worker-isolation
echo 'D5 phase: inspect worker isolation'
worker_id=$(docker inspect --format '{{.Id}}' "$worker")
image_id=$(docker inspect --format '{{.Image}}' "$worker")
test "$(docker exec "$worker" id -u)" != "0"
test -z "$(docker port "$worker")"
! docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$worker" | grep -q '^AUTH_SECRET='
! docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$worker" | grep -q '^ACCOUNT_RECOVERY_ABUSE_KEY='
! docker logs "$worker" 2>&1 | grep -F "$mail_key"
! docker logs "$worker" 2>&1 | grep -F "$previous_mail_key"
! docker logs "$worker" 2>&1 | grep -F 'nexus-ci-password'

phase=tls-settlement
echo 'D5 phase: wait for TLS acceptance and DB settlement'
accepted=0
for attempt in $(seq 1 40); do
  if NEXUS_D5_MAIL_CHECK=true node --import tsx packages/db/scripts/check-account-mail-delivery-ci.ts "$challenge" "$mail" > /tmp/nexus-d5-check.out 2> /tmp/nexus-d5-check.err; then
    code=0
  else
    code=$?
  fi
  if [[ $code == 0 ]] && grep -q '^PASS$' /tmp/nexus-d5-check.out; then accepted=1; break; fi
  sleep 0.25
done
test "$accepted" = 1
test ! -s /tmp/nexus-d5-check.err

phase=supervised-crash-restart
echo 'D5 phase: supervised crash restart'
restart_before=$(docker inspect --format '{{.RestartCount}}' "$worker")
ready_before=$(docker logs "$worker" 2>&1 | grep -c '"status":"ready"' || true)
# Let Docker observe a successful start before exercising its restart policy.
sleep 10
# docker kill marks a manual stop and suppresses unless-stopped restart.
# Signal only this disposable container's host PID to simulate a process crash.
worker_pid=$(docker inspect --format '{{.State.Pid}}' "$worker")
[[ "$worker_pid" =~ ^[0-9]+$ && "$worker_pid" -gt 1 ]]
sudo kill -KILL "$worker_pid"
restarted=0
for attempt in $(seq 1 100); do
  running=$(docker inspect --format '{{.State.Running}}' "$worker" 2>/dev/null || true)
  restart_now=$(docker inspect --format '{{.RestartCount}}' "$worker" 2>/dev/null || echo 0)
  ready_now=$(docker logs "$worker" 2>&1 | grep -c '"status":"ready"' || true)
  if [[ "$running" == true && "$restart_now" -gt "$restart_before" && "$ready_now" -gt "$ready_before" ]]; then
    restarted=1
    break
  fi
  sleep 0.1
done
test "$restarted" = 1
test "$(docker inspect --format '{{.Image}}' "$worker")" = "$image_id"
test -z "$(docker port "$worker")"
! docker logs "$worker" 2>&1 | grep -F "$mail_key"
! docker logs "$worker" 2>&1 | grep -F "$previous_mail_key"
! docker logs "$worker" 2>&1 | grep -F 'nexus-ci-password'

phase=graceful-recreate
echo 'D5 phase: graceful stop and same-image recreate'
docker stop --time 10 "$worker" >/dev/null
test "$(docker inspect --format '{{.State.ExitCode}}' "$worker")" = "0"
docker rm "$worker" >/dev/null
start_worker
wait_ready
test "$(docker inspect --format '{{.Id}}' "$worker")" != "$worker_id"
test "$(docker inspect --format '{{.Image}}' "$worker")" = "$image_id"
docker stop --time 10 "$worker" >/dev/null
test "$(docker inspect --format '{{.State.ExitCode}}' "$worker")" = "0"
docker rm "$worker" >/dev/null

phase=missing-key-fail-closed
echo 'D5 phase: missing-key fail-closed'
if docker run --rm --add-host host.docker.internal:host-gateway \
  --env DATABASE_URL=postgres://nexus:nexus_test_secret@host.docker.internal:5432/nexus_mail_acceptance \
  --env ACCOUNT_MAIL_KEY_ID=ci --env ACCOUNT_MAIL_KEY= \
  --env ACCOUNT_MAIL_APP_URL=https://nexus-mta.test \
  --env ACCOUNT_MAIL_SMTP_HOST="$smtp_host" --env ACCOUNT_MAIL_SMTP_PORT=2465 \
  --env ACCOUNT_MAIL_SMTP_SERVERNAME=localhost --env ACCOUNT_MAIL_SMTP_FROM=no-reply@nexus-mta.test \
  "$image" sh -c 'cd /app/packages/db && exec node --import tsx scripts/run-account-mail-dispatcher.ts --once' \
  > /tmp/nexus-d5-missing.out 2> /tmp/nexus-d5-missing.err; then
  code=0
else
  code=$?
fi
test "$code" -ne 0
grep -Fxq '{"status":"failed"}' /tmp/nexus-d5-missing.err
! grep -F "$mail_key" /tmp/nexus-d5-missing.err
! grep -F nexus_test_secret /tmp/nexus-d5-missing.err

phase=cleanup
trap - EXIT
cleanup
trap - ERR
echo 'PASS: opt-in production-image mail worker accepted synthetic TLS mail, exposed no ports/auth/abuse secrets, stopped cleanly, recreated on the same image and failed closed without its mail key.'
