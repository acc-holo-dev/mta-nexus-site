#!/bin/sh
set -eu

# The runtime image contains two self-contained production payloads:
# the deployed database package for migrations/workers and Next.js standalone for HTTP.
#
# Single migration phase (OPS-12): this entrypoint applies forward-only migrations
# before HTTP starts. During maintenance, stop every application writer first
# (app, push-worker, license-worker, resource-release-worker, optional mail-worker
# and any external jobs) while leaving PostgreSQL up for dump; do not open ingress
# after a failed migration. See docs/OPERATIONS.md writer inventory.
#
# OPS-05 / ARC10: application origin is a runtime value for one image digest.
# Prefer canonical APP_URL; keep NEXT_PUBLIC_APP_URL aligned for historical server
# readers (CSRF/helpers). Build-stage placeholders must not open HTTP — @nexus/config
# validation below fails closed before migrate/server.
if [ -n "${APP_URL:-}" ]; then
  export NEXT_PUBLIC_APP_URL="$APP_URL"
elif [ -n "${NEXT_PUBLIC_APP_URL:-}" ]; then
  export APP_URL="$NEXT_PUBLIC_APP_URL"
fi

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

cd "$root/packages/db"
test -d migrations
test -n "$(find migrations -type f -name '*.sql' -print -quit)"
# Validate the web process explicitly; the database client is also used by isolated workers.
node --import tsx --input-type=module -e "import '@nexus/config';"
node --import tsx src/migrate.ts

cd "$root/apps/web"
exec node server.js
