#!/bin/sh
set -eu

# The runtime image contains two self-contained production payloads:
# the deployed database package for migrations/workers and Next.js standalone for HTTP.
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

cd "$root/packages/db"
node --import tsx src/migrate.ts

cd "$root/apps/web"
exec node server.js
