---
title: Install with Dokploy
description: Deploy Freenary from the Dokploy template.
---

This page deploys Freenary on Dokploy, a self-hosted panel that runs Docker Compose stacks behind its own reverse proxy. The repository ships a Dokploy template made of two files: `deploy/docker-compose.yml`, the stack that publishes no host port, and `deploy/dokploy/template.toml`, which declares its variables and its domain.

## Before you start

- Dokploy runs on your server, and you can sign in to its panel.
- You have a domain name that points at the server, or you let Dokploy generate one.
- [Bun](https://bun.sh) and `git` are installed on your own machine. You use them once, to produce the import string.

## Steps

1. Clone the repository and print the import string:

   ```bash
   git clone https://github.com/suiramdev/freenary.git
   cd freenary
   bun run deploy:dokploy
   ```

   The command prints one long line of base64 text. It encodes a JSON object with two keys: `compose`, the content of `deploy/docker-compose.yml`, and `config`, the content of `deploy/dokploy/template.toml`. Copy the whole line.

2. In Dokploy, create a Compose service and import the string.

   > **TODO (unverified):** the Dokploy panel path to create a Compose service, where the **Import** field sits, and the button that applies it. Also check whether Freenary appears in the Dokploy template list, which would make steps 1 and 2 unnecessary.

3. Check the environment variables Dokploy created from the template. The template fills them like this:

   ```dotenv
   FREENARY_URL=http://${main_domain}
   FREENARY_VERSION=latest
   POSTGRES_PASSWORD=${postgres_password}
   BETTER_AUTH_SECRET=${auth_secret}
   ```

   `main_domain` comes from `${domain}`, `postgres_password` from `${password:32}` and `auth_secret` from `${password:64}`. Dokploy replaces these helpers with a domain and random passwords.

   > **TODO (unverified):** that Dokploy turns `${domain}` into a generated domain and `${password:N}` into a random password of N characters, and where the panel shows the result.

4. If you serve the domain over HTTPS, change `FREENARY_URL` to `https://` followed by the domain. `FREENARY_URL` must be the exact address in the browser bar, because it fills `BETTER_AUTH_URL`, `CORS_ORIGIN` and `PUBLIC_SERVER_URL`.

   > **TODO (unverified):** how you turn HTTPS on for a domain in Dokploy.

5. Check the domain. The template routes it to the `web` service on port `3001`. The web app forwards the API paths `/api/auth`, `/rpc`, `/ai/chat` and `/api-reference` to the `server` service, so you need no second domain for the API.
6. Deploy the service.

   > **TODO (unverified):** the name of the deploy button in Dokploy, and where the panel shows the logs of each container.

7. Open `FREENARY_URL` in a browser and create the first account. That account becomes the operator, the account that sets up the instance. See [First run and the operator](../explanation/first-run-and-operator.md).

To set another server setting, such as an email provider, add it to the environment variables of the service and deploy again. `deploy/docker-compose.yml` loads an optional `.env` file next to it into the `server` container. See [Configuration](../reference/configuration.md) for every variable.

> **TODO (unverified):** that Dokploy writes the service environment variables to a `.env` file next to the compose file, so that variables outside the template reach the `server` container.

## Check that it works

1. Ask the API through the public address:

   ```bash
   curl https://freenary.example.com/api/auth/ok
   ```

   The answer is `{"ok":true}`.

2. Read the logs of the `server` container. Before anyone signs up, they end with:

   ```text
   This instance has no operator yet. The first account to sign in at https://freenary.example.com becomes the operator.
   ```

## If something goes wrong

- The deploy stops with `Set FREENARY_URL to the public URL of the web app, such as https://freenary.example.com`, `Set POSTGRES_PASSWORD` or `Set BETTER_AUTH_SECRET to 32 characters or more`. The variable is missing or empty. Set it in the service environment and deploy again.
- Sign-in fails with **Something went wrong. Try again.**, and the `server` log shows `[Better Auth]: Invalid origin: …`. `FREENARY_URL` differs from the address in the browser, often `http://` against `https://`. Set `FREENARY_URL` to the exact address and deploy again.
- The `server` log shows `TRUSTED_PROXIES is not set. …`. Dokploy's proxy sits in front of the web app, so every visitor shares one sign-in rate limit. Set `TRUSTED_PROXIES` to the address or range of that proxy, as the `web` container sees it. See [Use an existing reverse proxy](use-an-existing-reverse-proxy.md#steps).

  > **TODO (unverified):** which Docker network Dokploy's proxy and the `web` container share, and its address range.

- The browser shows `Bad Gateway`, or a container stays unhealthy. See [Troubleshoot](troubleshoot.md).

## Related

- [Use an existing reverse proxy](use-an-existing-reverse-proxy.md)
- [Compose files](../reference/compose-files.md)
- [Update Freenary](update-freenary.md)
