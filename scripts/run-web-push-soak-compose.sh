#!/usr/bin/env bash
# Run the Web Push soak against the local Compose Postgres network.
# Host `localhost:5432` is unpublished in compose.yaml — prefer this entrypoint.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${NEXUS_WEB_PUSH_SOAK_ACK:-}" != "YES" ]]; then
  echo "Refusing Web Push soak without NEXUS_WEB_PUSH_SOAK_ACK=YES" >&2
  exit 1
fi

PROJECT="${COMPOSE_PROJECT_NAME:-nexus-local}"
COMPOSE=(docker compose -p "$PROJECT" -f compose.yaml)
DURATION_MS="${NEXUS_WEB_PUSH_SOAK_DURATION_MS:-60000}"
EVIDENCE_HOST="$(pwd)/artifacts"
EVIDENCE_CONTAINER="/workspace/artifacts/web-push-soak-evidence.json"

mkdir -p "$EVIDENCE_HOST"

echo "Ensuring postgres is healthy…"
"${COMPOSE[@]}" up -d postgres
"${COMPOSE[@]}" wait postgres

# App applies migrations on start; required before soak schema access.
if ! "${COMPOSE[@]}" ps app --status running --quiet 2>/dev/null | grep -q .; then
  echo "Starting app so migrations are applied…"
  "${COMPOSE[@]}" up -d --build app
fi
echo "Waiting for app healthy…"
for _ in $(seq 1 60); do
  health="$("${COMPOSE[@]}" ps app --format '{{.Health}}' 2>/dev/null || true)"
  if [[ "$health" == "healthy" ]]; then
    break
  fi
  sleep 5
done
health="$("${COMPOSE[@]}" ps app --format '{{.Health}}' 2>/dev/null || true)"
if [[ "$health" != "healthy" ]]; then
  echo "App is not healthy (status=${health:-unknown}); refusing soak." >&2
  exit 1
fi

echo "Stopping push-worker so it does not race the soak dispatcher…"
"${COMPOSE[@]}" stop push-worker >/dev/null 2>&1 || true

echo "Running soak in the compose network (durationMs=${DURATION_MS})…"
"${COMPOSE[@]}" run --rm --no-deps \
  -e NEXUS_WEB_PUSH_SOAK_ACK=YES \
  -e "NEXUS_WEB_PUSH_SOAK_DURATION_MS=${DURATION_MS}" \
  -e NEXUS_WEB_PUSH_SOAK_WAVE_INTERVAL_MS="${NEXUS_WEB_PUSH_SOAK_WAVE_INTERVAL_MS:-2000}" \
  -e NEXUS_WEB_PUSH_SOAK_NOTIFICATIONS_PER_WAVE="${NEXUS_WEB_PUSH_SOAK_NOTIFICATIONS_PER_WAVE:-2}" \
  -e NEXUS_WEB_PUSH_SOAK_SUBSCRIPTIONS="${NEXUS_WEB_PUSH_SOAK_SUBSCRIPTIONS:-2}" \
  -e NEXUS_WEB_PUSH_SOAK_WORKERS="${NEXUS_WEB_PUSH_SOAK_WORKERS:-2}" \
  -e NEXUS_WEB_PUSH_SOAK_DRAIN_TIMEOUT_MS="${NEXUS_WEB_PUSH_SOAK_DRAIN_TIMEOUT_MS:-120000}" \
  -e "NEXUS_WEB_PUSH_SOAK_EVIDENCE_PATH=${EVIDENCE_CONTAINER}" \
  -e DATABASE_URL=postgres://nexus:nexus_secret@postgres:5432/mta_nexus \
  -v "${EVIDENCE_HOST}:/workspace/artifacts" \
  push-worker \
  node --import tsx scripts/run-web-push-soak.ts

node scripts/check-web-push-soak-evidence.mjs "${EVIDENCE_HOST}/web-push-soak-evidence.json"
echo "Soak evidence verified at ${EVIDENCE_HOST}/web-push-soak-evidence.json"
echo "Optional: docker compose -p ${PROJECT} -f compose.yaml start push-worker"
