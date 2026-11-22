<h1><img src=".github/assets/agent.gif" alt="The Freenary agent, a pink piggy-bank head, tossing coins with sparkles all around" width="48" height="48" align="absmiddle"> Freenary</h1>

Freenary is an open-source personal finance app that you host yourself. It connects to your banks through a bank provider (Powens or Enable Banking), imports your accounts and transactions, puts them into categories, and shows a budget. An optional assistant answers questions about your money. Your data stays in your own PostgreSQL database.

## Get it running

You need Docker with Compose v2 and a Unix shell (on Windows, a WSL 2 terminal).

```bash
mkdir -p ~/freenary && cd ~/freenary
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/suiramdev/freenary/main/docker-compose.yml
cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 16)
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
EOF
docker compose up -d --wait
```

Open `http://localhost:3001` and create the first account: it becomes the operator.

The full tutorial, with checks after each step and fixes for common errors, is [Get it running](docs/tutorials/get-it-running.md). To run Freenary under your own domain with HTTPS, follow [Self-host on a server](docs/tutorials/self-host-on-a-server.md).

## Documentation

All documentation is in [`docs/`](docs/index.md):

- **Tutorials:** [Get it running](docs/tutorials/get-it-running.md), [Self-host on a server](docs/tutorials/self-host-on-a-server.md), [Connect your first bank](docs/tutorials/connect-your-first-bank.md)
- **How-to guides:** install another way, configure banks, email, sign-in, the assistant and categorisation, update, back up, troubleshoot
- **Reference:** [configuration](docs/reference/configuration.md), [Compose files](docs/reference/compose-files.md), [images](docs/reference/images.md), [commands](docs/reference/commands.md), [API](docs/reference/api.md)
- **Explanation:** [architecture](docs/explanation/architecture.md), [first run](docs/explanation/first-run-and-operator.md), [settings](docs/explanation/settings-sources.md), [sign-in and email](docs/explanation/sign-in-and-email.md), [assistant](docs/explanation/assistant.md), [categorisation](docs/explanation/categorisation.md)

For AI tools: [`docs/llms.txt`](docs/llms.txt) and [`AGENTS.md`](AGENTS.md).

## Contributing

Read [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md). Pull requests target `dev`.

## Support

Report a problem or request a feature in [GitHub Issues](https://github.com/suiramdev/freenary/issues/new/choose).

## License

Freenary is free software under the [GNU Affero General Public License v3.0 or later](LICENSE). If you change Freenary and let other people use it over a network, you must offer them the source of your version. Third-party notices: [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

Copyright (C) 2026 Marius ([@suiramdev](https://github.com/suiramdev)) and the Freenary contributors.
