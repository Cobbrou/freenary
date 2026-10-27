# syntax=docker/dockerfile:1
FROM oven/bun:1.3.14 AS builder
WORKDIR /app
ENV SKIP_ENV_VALIDATION=1
# prisma generate resolves DATABASE_URL at install time; the real value comes from compose at runtime
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache bun install

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

FROM oven/bun:1.3.14 AS runner
WORKDIR /app
ENV NODE_ENV=production
# Under its own name: the stack's `.env` sets `FREENARY_VERSION` to the image
# tag, and the server service loads that file whole.
ARG FREENARY_VERSION=""
ENV FREENARY_BUILD_VERSION=$FREENARY_VERSION
COPY --from=builder /app /app

EXPOSE 3000

WORKDIR /app/apps/server
CMD ["bun", "dist/index.mjs"]
