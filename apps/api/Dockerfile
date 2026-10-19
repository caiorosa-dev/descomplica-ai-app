# Build context: repository root (see docker-compose.yml).
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
# Lockfile first so dependency downloads are cached while sources change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter "@app/api..."
RUN pnpm --filter @app/db exec prisma generate
RUN pnpm turbo build --filter=@app/api
RUN pnpm prune --prod --ignore-scripts

FROM base AS runner
ENV NODE_ENV=production \
    CORPUS_DIR=/app/corpus \
    UPLOAD_DIR=/data/uploads
COPY --from=build /app /app
RUN chmod +x /app/apps/api/docker-entrypoint.sh
EXPOSE 3333
ENTRYPOINT ["/app/apps/api/docker-entrypoint.sh"]
