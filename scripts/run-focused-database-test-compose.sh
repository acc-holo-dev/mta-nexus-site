#!/usr/bin/env bash
# Run focused Vitest database files against a disposable DB on the Compose network.
# Host localhost:5432 is unpublished in compose.yaml — prefer this entrypoint locally.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <tests/database/...integration.test.ts> [more test files...]" >&2
  exit 1
fi

if [[ -n "${DOCKER_HOST:-}" || -n "${DOCKER_CONTEXT:-}" ]]; then
  echo "Refusing focused database tests with Docker host/context overrides." >&2
  exit 1
fi
if [[ "${COMPOSE_PROJECT_NAME:-nexus-local}" != "nexus-local" ]]; then
  echo "Refusing focused database tests outside the nexus-local Compose project." >&2
  exit 1
fi
if ! docker_context=$(docker context show) || [[ "$docker_context" != "default" ]]; then
  echo "Refusing focused database tests without the default local Docker context." >&2
  exit 1
fi

PROJECT="nexus-local"
COMPOSE=(docker compose -p "$PROJECT" -f compose.yaml)
DB_NAME="nexus_focus_$(date +%s)_${RANDOM}"
DATABASE_URL="postgres://nexus:nexus_secret@postgres:5432/${DB_NAME}"
database_created=0

for arg in "$@"; do
  if [[ "$arg" == -* || ! -f "$arg" || "$arg" != tests/* ]]; then
    echo "Expected an existing tests/... file path: $arg" >&2
    exit 1
  fi
done

cleanup() {
  local status=$?
  local remaining
  trap - EXIT
  # Never remove a pre-existing database if creation failed (e.g. a name collision).
  if [[ "$database_created" == 1 ]]; then
    if ! "${COMPOSE[@]}" exec -T postgres \
      psql -U nexus -d postgres -v ON_ERROR_STOP=1 \
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
      >/dev/null; then
      echo "Could not terminate connections to owned test database ${DB_NAME}; attempting cleanup." >&2
    fi
    if ! "${COMPOSE[@]}" exec -T postgres \
      psql -U nexus -d postgres -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";" >/dev/null; then
      echo "Could not remove owned test database ${DB_NAME}." >&2
      if [[ "$status" == 0 ]]; then status=1; fi
    fi
    if ! remaining=$("${COMPOSE[@]}" exec -T postgres \
      psql -U nexus -d postgres -v ON_ERROR_STOP=1 -At \
      -c "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}';"); then
      echo "Could not verify removal of owned test database ${DB_NAME}." >&2
      if [[ "$status" == 0 ]]; then status=1; fi
    elif [[ -n "$remaining" ]]; then
      echo "Owned test database ${DB_NAME} still exists after cleanup." >&2
      if [[ "$status" == 0 ]]; then status=1; fi
    fi
  fi
  exit "$status"
}
trap cleanup EXIT

echo "Ensuring postgres is healthy…"
"${COMPOSE[@]}" up -d postgres
for _ in $(seq 1 60); do
  health="$("${COMPOSE[@]}" ps postgres --format '{{.Health}}' 2>/dev/null || true)"
  if [[ "$health" == "healthy" ]]; then
    break
  fi
  sleep 2
done
health="$("${COMPOSE[@]}" ps postgres --format '{{.Health}}' 2>/dev/null || true)"
if [[ "$health" != "healthy" ]]; then
  echo "Postgres is not healthy (status=${health:-unknown}); refusing focused database tests." >&2
  exit 1
fi

echo "Creating disposable database ${DB_NAME}…"
"${COMPOSE[@]}" exec -T postgres \
  psql -U nexus -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE \"${DB_NAME}\" OWNER nexus;"
database_created=1

echo "Applying migrations…"
"${COMPOSE[@]}" run --rm --no-deps \
  -e "DATABASE_URL=${DATABASE_URL}" \
  -e NEXUS_DISPOSABLE_DATABASE=1 \
  app \
  pnpm db:migrate

echo "Running focused database tests: $*"
# Bind-mount the live checkout so new tests are visible without rebuilding the image.
"${COMPOSE[@]}" run --rm --no-deps \
  -e "DATABASE_URL=${DATABASE_URL}" \
  -e NEXUS_DISPOSABLE_DATABASE=1 \
  -e AUTH_SECRET=development-only-secret-change-before-production \
  -e NODE_ENV=test \
  -v "$(pwd)/tests:/app/tests:ro" \
  -v "$(pwd)/packages/db/src:/app/packages/db/src:ro" \
  -v "$(pwd)/packages/db/migrations:/app/packages/db/migrations:ro" \
  -v "$(pwd)/scripts:/app/scripts:ro" \
  app \
  pnpm test:focus "$@"
