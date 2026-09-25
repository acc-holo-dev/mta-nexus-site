# A separate local target: no host Node/pnpm, host mounts or production bypasses.
FROM node:26-alpine AS development
WORKDIR /app
ENV NODE_ENV=development NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.4.2
COPY . .
RUN pnpm install --frozen-lockfile --prod=false \
    && mkdir -p /data/uploads \
    && chown -R node:node /app /data/uploads
USER node
EXPOSE 3000
# A migration failure stops the container before Next.js can accept requests.
CMD ["sh", "-c", "pnpm db:migrate && exec pnpm --filter @nexus/web dev --hostname 0.0.0.0"]

FROM node:26-alpine AS build
WORKDIR /app
RUN npm install --global pnpm@12.4.2
ENV NODE_ENV=production \
    NEXT_PUBLIC_APP_URL=https://nexus-mta.com \
    DATABASE_URL=postgres://nexus:build-only@127.0.0.1:5432/mta_nexus \
    AUTH_SECRET=build-only-secret-that-is-long-enough-for-validation \
    STORAGE_PROVIDER=local \
    STORAGE_LOCAL_PATH=/data/uploads \
    EMAIL_PROVIDER=disabled \
    BUILD_SCANNER=clamav \
    CLAMAV_HOST=clamav \
    CLAMAV_PORT=3310 \
    SMTP_FROM=no-reply@nexus-mta.com
COPY . .
RUN pnpm install --frozen-lockfile --prod=false
RUN pnpm build \
    && test -f apps/web/.next/standalone/apps/web/server.js \
    && test -d apps/web/.next/static
# Migrations and the optional mail worker intentionally remain TypeScript.
# Deploy only their production dependency graph instead of copying the whole workspace.
RUN pnpm --filter @nexus/db --prod deploy /runtime/db \
    && test -f /runtime/db/src/migrate.ts \
    && test -f /runtime/db/scripts/run-account-mail-dispatcher.ts \
    && test -f /runtime/db/node_modules/tsx/package.json

FROM node:26-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0
# The standalone tree contains the traced Next.js server and runtime dependencies.
COPY --from=build /app/apps/web/.next/standalone/ /app/
COPY --from=build /app/apps/web/.next/static /app/apps/web/.next/static
# Keep the database runtime independently portable for migrations and the opt-in mail worker.
COPY --from=build /runtime/db /app/packages/db
COPY --from=build /app/scripts/start-production.sh /app/scripts/start-production.sh
COPY --from=build /app/scripts/check-local-readiness.mjs /app/scripts/check-local-readiness.mjs
COPY --from=build /app/scripts/check-account-mail-worker-health.mjs /app/scripts/check-account-mail-worker-health.mjs
RUN mkdir -p /data/uploads && chown -R node:node /data/uploads
USER node
EXPOSE 3000
# Execute installed runtime tools directly; no package manager is needed in this image.
CMD ["sh", "scripts/start-production.sh"]
