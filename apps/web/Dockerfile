FROM oven/bun:1.3.14 AS builder
WORKDIR /app
# prisma generate resolves DATABASE_URL at install time; the real value comes from compose at runtime
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache bun install

# The browser learns the API origin at runtime from PUBLIC_SERVER_URL, so one
# image serves any deployment; VITE_SERVER_URL is the localhost fallback.
ENV NODE_ENV=production

# The release tag reaches the browser through the build: one image is one
# version, and the account menu links to the documentation for it.
ARG FREENARY_VERSION=""
ENV VITE_FREENARY_VERSION=$FREENARY_VERSION

RUN cd apps/web && bun run build
ENV DATABASE_URL=

FROM oven/bun:1.3.14 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app /app

ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

# SSR chunks require workspace dependencies at runtime
WORKDIR /app/apps/web
CMD ["bun", ".output/server/index.mjs"]
