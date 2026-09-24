#!/bin/sh
set -eu

# Dependencies are installed in the build stage, never at container startup.
# A migration error exits before the HTTP server starts.
cd "$(dirname "$0")/.."
node --import tsx packages/db/src/migrate.ts
cd apps/web
exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0
