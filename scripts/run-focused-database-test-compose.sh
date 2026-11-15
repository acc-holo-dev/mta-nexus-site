#!/usr/bin/env bash
# Run focused Vitest database files against a disposable DB on the Compose network.
# Host localhost:5432 is unpublished in compose.yaml — prefer this entrypoint locally.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <site/tests/...test.ts|site/src/...test.ts> [more test files...]" >&2
  exit 1
fi

# Validate all inputs before starting containers or creating a database.
node scripts/validate-focused-compose.mjs "$@"

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
COMPOSE=(docker compose -p "$PROJECT" -f docker/compose.yaml)
DB_NAME="nexus_focus_$(date +%s)_${RANDOM}"
DATABASE_URL="postgres://nexus:nexus_secret@postgres:5432/${DB_NAME}"
database_created=0
# This path is inside each --rm container, not the development uploads volume.
FOCUS_STORAGE_PATH="/tmp/nexus-focus-uploads"
# Set after installing the cleanup trap, before any container is started.
FOCUS_EMPTY_UPLOADS=""
# One-off tests must not inherit local push credentials or contact a shared scanner.
FOCUS_ENV=(
  -e "STORAGE_LOCAL_PATH=${FOCUS_STORAGE_PATH}"
  -e BUILD_SCANNER=disabled
  -e EMAIL_PROVIDER=disabled
  -e WEB_PUSH_VAPID_PUBLIC_KEY=
  -e WEB_PUSH_VAPID_PRIVATE_KEY=
  -e WEB_PUSH_VAPID_SUBJECT=
)

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
  # rmdir only removes our empty directory; never recursively delete its contents.
  if [[ -n "$FOCUS_EMPTY_UPLOADS" ]] && ! rmdir "$FOCUS_EMPTY_UPLOADS"; then
    echo "Could not remove the owned empty focused-test mount directory." >&2
    if [[ "$status" == 0 ]]; then status=1; fi
  fi
  exit "$status"
}
trap cleanup EXIT

# Mask development uploads even if a test ignores STORAGE_LOCAL_PATH.
FOCUS_EMPTY_UPLOADS=$(mktemp -d "${TMPDIR:-/tmp}/nexus-focus-empty.XXXXXXXX")
# Docker bind mounts require an absolute path even if TMPDIR is relative.
absolute_uploads=$(cd "$FOCUS_EMPTY_UPLOADS" && pwd -P)
FOCUS_EMPTY_UPLOADS=$absolute_uploads

echo "Ensuring postgres is healthy without recreating an existing container…"
"${COMPOSE[@]}" up -d --no-recreate postgres
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
  "${FOCUS_ENV[@]}" \
  -v "${FOCUS_EMPTY_UPLOADS}:/data/uploads:ro" \
  app \
  pnpm db:migrate

echo "Running focused database tests: $*"
# Bind-mount the live checkout so new tests are visible without rebuilding the image.
"${COMPOSE[@]}" run --rm --no-deps \
  -e "DATABASE_URL=${DATABASE_URL}" \
  -e NEXUS_DISPOSABLE_DATABASE=1 \
  "${FOCUS_ENV[@]}" \
  -e AUTH_SECRET=development-only-secret-change-before-production \
  -e NODE_ENV=test \
  -v "${FOCUS_EMPTY_UPLOADS}:/data/uploads:ro" \
  -v "$(pwd)/site/tests:/app/site/tests:ro" \
  -v "$(pwd)/site/packages/db/src:/app/site/packages/db/src:ro" \
  -v "$(pwd)/site/packages/db/migrations:/app/site/packages/db/migrations:ro" \
  -v "$(pwd)/scripts:/app/scripts:ro" \
  -v "$(pwd)/vitest.config.ts:/app/vitest.config.ts:ro" \
  app \
  pnpm test:focus "$@"
