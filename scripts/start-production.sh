#!/bin/sh
set -eu

# The runtime image contains two self-contained production payloads:
# the deployed database package for migrations/workers and Next.js standalone for HTTP.
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

cd "$root/packages/db"
test -d migrations
test -n "$(find migrations -type f -name '*.sql' -print -quit)"
# Validate the web process explicitly; the database client is also used by isolated workers.
node --import tsx --input-type=module -e "import '@nexus/config';"
node --import tsx src/migrate.ts

cd "$root/apps/web"
exec node server.js
