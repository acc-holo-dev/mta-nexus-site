FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app /app
RUN mkdir -p /data/uploads && chown -R node:node /data/uploads
USER node
EXPOSE 3000
CMD ["pnpm", "start"]
