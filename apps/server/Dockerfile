# syntax=docker/dockerfile:1
FROM oven/bun:1.4.5 AS builder
WORKDIR /app
ENV SKIP_ENV_VALIDATION=1
# prisma generate resolves DATABASE_URL at install time; the real value comes from compose at runtime
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

# Manifests and the Prisma schema first: the install layer stays cached until a
# dependency changes, and the db postinstall (prisma generate) finds its schema.
COPY --parents package.json bun.lock apps/*/package.json packages/*/package.json \
    packages/db/prisma.config.ts packages/db/prisma/schema ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
COPY . .

ENV NODE_ENV=production
# The merchant data comes from the newest `data-*` GitHub release of this
# repository. A fork passes its own slug; the token only lifts the API rate
# limit and never reaches the image.
ARG GITHUB_REPOSITORY=suiramdev/freenary
RUN --mount=type=secret,id=GITHUB_TOKEN \
    cd packages/api && \
    GITHUB_REPOSITORY=${GITHUB_REPOSITORY} \
    GITHUB_TOKEN="$(cat /run/secrets/GITHUB_TOKEN 2>/dev/null || true)" \
    bun run build:data
RUN cd apps/server && bun run build

# The production dependencies of the server workspace, without the sources.
# dist/ bundles the @freenary/* packages and imports the rest from here; the
# `migrate` service runs the Prisma CLI that @freenary/db depends on.
FROM oven/bun:1.4.5 AS deps
WORKDIR /app
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY --parents package.json bun.lock apps/*/package.json packages/*/package.json \
    packages/db/prisma.config.ts packages/db/prisma/schema ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --filter server

FROM oven/bun:1.4.5 AS runner
WORKDIR /app
ENV NODE_ENV=production
# Under its own name: the stack's `.env` sets `FREENARY_VERSION` to the image
# tag, and the server service loads that file whole.
ARG FREENARY_VERSION=""
ENV FREENARY_BUILD_VERSION=$FREENARY_VERSION

COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/server/node_modules apps/server/node_modules
COPY --from=deps /app/packages/db/node_modules packages/db/node_modules
# What `bun x prisma migrate deploy` reads in /app/packages/db.
COPY --from=builder /app/packages/db/package.json /app/packages/db/prisma.config.ts packages/db/
COPY --from=builder /app/packages/db/prisma/schema packages/db/prisma/schema
COPY --from=builder /app/packages/db/prisma/migrations packages/db/prisma/migrations
# The bundle resolves the merchant data from its own directory, dist/../../data.
COPY --from=builder /app/packages/api/data apps/data
COPY --from=builder /app/apps/server/dist apps/server/dist
USER bun

EXPOSE 3000

WORKDIR /app/apps/server
CMD ["bun", "dist/index.mjs"]
