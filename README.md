# Freenary

Freenary is an open-source personal finance app that you host yourself. It connects your banks, imports your accounts and transactions, categorises them, and shows you where your money goes — all in your own PostgreSQL database. Freenary is under active development: the Budget area works end to end, and three more areas (Portfolio, Analysis, Goals) are planned.

## Quick start

You need Docker Engine with Compose v2, and an account with a bank provider. The full walkthrough lives at [Quickstart](https://freenary.dev/docs/quickstart).

### 1. Get the two files

```bash
mkdir freenary && cd freenary
curl -O https://raw.githubusercontent.com/suiramdev/freenary/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/suiramdev/freenary/main/.env.example
```

### 2. Write the three values

```bash
cp .env.example .env
openssl rand -hex 16   # POSTGRES_PASSWORD
openssl rand -hex 32   # BETTER_AUTH_SECRET
```

Open `.env` and write these three lines:

```dotenv
POSTGRES_PASSWORD=<the first value>
BETTER_AUTH_SECRET=<the second value>
FREENARY_VERSION=latest
```

`latest` is the newest release. Pin a version such as `0.1` for an instance you keep; the [Releases](https://github.com/suiramdev/freenary/releases) page lists them.

### 3. Set up the bank provider

Powens is the default provider. Create a sandbox domain in the [Powens console](https://console.powens.com), then write the credentials into `.env`:

```dotenv
BANKING_PROVIDER=powens
POWENS_DOMAIN=acme-sandbox
POWENS_CLIENT_ID=<client id>
POWENS_CLIENT_SECRET=<client secret>
```

[Bank providers](https://freenary.dev/docs/self-hosting/bank-providers) walks each console step.

### 4. Start the stack

```bash
docker compose up -d
```

### 5. Check the two services

```bash
curl http://localhost:3000/
curl -L -o /dev/null -w '%{http_code} %{url_effective}\n' http://localhost:3001/
```

The API server answers `OK`. The web app prints `200 http://localhost:3001/login`.

### 6. Create the first account

Open <http://localhost:3001>. Sign up with an email address and a password. With no email provider configured, Freenary signs you in at once.

> These defaults reach `localhost` and nobody else. Read [Self-hosting](https://freenary.dev/docs/self-hosting) before you serve the instance to other people.

## Documentation

The full documentation lives at [freenary.dev](https://freenary.dev) (source in [`apps/fumadocs`](apps/fumadocs)):

- [Quickstart](https://freenary.dev/docs/quickstart) — a running instance on one machine
- [Concepts](https://freenary.dev/docs/concepts) — the vocabulary the interface uses
- [Using Freenary](https://freenary.dev/docs/guides) — what you do on each screen
- [Self-hosting](https://freenary.dev/docs/self-hosting) — the install that serves other people
- [Hosting panels](https://freenary.dev/docs/self-hosting/hosting-panels) — Dokploy, Coolify and other Docker panels, behind one hostname
- [Configuration](https://freenary.dev/docs/self-hosting/configuration) — every environment variable
- [Integrations](https://freenary.dev/docs/integrations) — the API surface and procedures
- [Contributing](https://freenary.dev/docs/contributing) — set up the code, run the checks, open a pull request
- [Architecture](https://freenary.dev/docs/contributing/architecture) — workspaces, request flow and build

## Development

```bash
git clone https://github.com/suiramdev/freenary.git
cd freenary
bun install
bun run dev:up
```

`dev:up` runs the full stack in Docker, one stack per worktree, at `http://web.<slug>.freenary.localhost` and its siblings. A shared [Traefik](https://traefik.io) proxy on port 80 routes every name. Without Docker for the apps:

```bash
cp .env.example .env
bun run db:start
bun run db:push
bun run dev          # web 3001, server 3000, docs 4000
```

Run the checks before opening a pull request:

```bash
bun run check        # lint and format
bun run check-types  # TypeScript
bun run build        # every app
```

## Contributing

Read [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md), then [`CONTEXT.md`](CONTEXT.md) for the product vocabulary. Pull requests target `dev`.

## Support

Report a problem or request a feature: [GitHub Issues](https://github.com/suiramdev/freenary/issues/new/choose).

## License

Freenary is free software under the [GNU Affero General Public License v3.0 or later](LICENSE). You may run, study, change and share it. If you change Freenary and let other people use it over a network, AGPL section 13 requires you to offer them the source of your version. Third-party notices: [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

Copyright (C) 2026 Marius ([@suiramdev](https://github.com/suiramdev)) and the Freenary contributors.
