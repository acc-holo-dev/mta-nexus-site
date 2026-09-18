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
RUN pnpm build

FROM node:26-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN npm install --global pnpm@12.4.2
COPY --from=build /app /app
RUN mkdir -p /data/uploads && chown -R node:node /data/uploads
USER node
EXPOSE 3000
CMD ["pnpm", "start"]
