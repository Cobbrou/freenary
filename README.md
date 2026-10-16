# Freenary

Freenary is an open-source personal finance app you host yourself. It connects your banks, imports your accounts and transactions, sorts them into categories, and shows your plan against your actual spending on the Budget screen. An assistant answers questions about your money. Your data stays in your own PostgreSQL database.

## Get started

Follow [Install Freenary](https://freenary.dev/docs/get-started/install). In short:

1. Point one domain at your server, for example `freenary.example.com`.
2. Deploy Freenary on a hosting panel (Dokploy, Coolify) or with Docker Compose behind your own HTTPS proxy.
3. Create the first account, which makes you the operator, then enter your bank and email credentials on the setup screen.

## Documentation

The full documentation lives at [freenary.dev](https://freenary.dev) (source in [`apps/fumadocs`](apps/fumadocs)):

- [Get started](https://freenary.dev/docs/get-started/before-you-install): install your instance and connect a bank
- [Use Freenary](https://freenary.dev/docs/use/budget): budget, bank connections, assistant, account
- [Run your instance](https://freenary.dev/docs/run/email): email, sign-in, updates, backups, troubleshooting
- [Reference](https://freenary.dev/docs/reference/configuration): configuration, bank providers, reverse proxy, API
- [Contribute](https://freenary.dev/docs/contribute): run the code, run the checks, open a pull request

## Development

```bash
git clone https://github.com/suiramdev/freenary.git
cd freenary
bun install
bun run dev:up
```

`dev:up` runs everything in Docker at `http://web.<slug>.freenary.localhost`. Without Docker for the apps:

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

Freenary is free software under the [GNU Affero General Public License v3.0 or later](LICENSE). If you change Freenary and let other people use it over a network, you must offer them the source of your version. Third-party notices: [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

Copyright (C) 2026 Marius ([@suiramdev](https://github.com/suiramdev)) and the Freenary contributors.
