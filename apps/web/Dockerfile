# syntax=docker/dockerfile:1
FROM oven/bun:1.4.5 AS builder
WORKDIR /app
# prisma generate resolves DATABASE_URL at install time; the real value comes from compose at runtime
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

# Manifests and the Prisma schema first: the install layer stays cached until a
# dependency changes, and the db postinstall (prisma generate) finds its schema.
COPY --parents package.json bun.lock apps/*/package.json packages/*/package.json \
    packages/db/prisma.config.ts packages/db/prisma/schema ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
COPY . .

# The browser learns the API origin at runtime from PUBLIC_SERVER_URL, so one
# image serves any deployment; VITE_SERVER_URL is the localhost fallback.
ENV NODE_ENV=production

RUN cd apps/web && bun run build
ENV DATABASE_URL=

# The Nitro output runs on its own: it bundles the workspace packages and the
# dependencies, and traces react and react-dom into .output/server/node_modules.
# The image carries that output and nothing else from the build.
FROM oven/bun:1.4.5 AS runner
WORKDIR /app/apps/web
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.output .output
USER bun

ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

CMD ["bun", ".output/server/index.mjs"]
