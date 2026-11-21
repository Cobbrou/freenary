---
title: Install with Coolify
description: Deploy Freenary from the Coolify template.
---

This page deploys Freenary on Coolify, a self-hosted panel that runs Docker Compose stacks behind its own reverse proxy. The repository ships a Coolify template, `deploy/coolify.yml`. It runs the same four services as the root `docker-compose.yml` (`postgres`, `migrate`, `server` and `web`) and lets Coolify generate the passwords and the public address.

## Before you start

- Coolify runs on your server, and you can sign in to its panel.
- You have a domain name that points at the server, or you let Coolify generate one.

## Steps

1. Get the template:

   ```bash
   curl -fsSLO https://raw.githubusercontent.com/suiramdev/freenary/main/deploy/coolify.yml
   ```

   Its first lines are the metadata Coolify reads for a service template: `documentation`, `slogan`, `category`, `tags`, `logo` and `port: 3001`.

2. In Coolify, create a resource from a Docker Compose file and paste the content of `coolify.yml`.

   > **TODO (unverified):** the Coolify panel path to create a resource from a Docker Compose file. Also check whether Freenary appears in the Coolify service list, which would make steps 1 and 2 unnecessary.

3. Check the values Coolify generates. The template uses Coolify's `SERVICE_` variables instead of a `.env` file:

   - `SERVICE_PASSWORD_POSTGRES` is the database password. It fills `POSTGRES_PASSWORD` and the `DATABASE_URL` of `migrate` and `server`.
   - `SERVICE_HEX_64_AUTHSECRET` becomes `BETTER_AUTH_SECRET`, the secret that signs sessions and seals the settings you save in the app.
   - `SERVICE_URL_WEB_3001`, on the `web` service, asks Coolify to route a public address to port `3001` of `web`. `SERVICE_URL_WEB` is that address. It fills `BETTER_AUTH_URL` and `CORS_ORIGIN` on `server`, and `PUBLIC_SERVER_URL` on `web`.

   > **TODO (unverified):** that Coolify generates a random password for `SERVICE_PASSWORD_POSTGRES`, 64 hexadecimal characters for `SERVICE_HEX_64_AUTHSECRET`, and a URL for `SERVICE_URL_WEB`, and where the panel shows them.

4. Set the domain of the `web` service to your domain. Use `https://` if Coolify serves it over HTTPS. The browser must reach Freenary at exactly that address: a different address makes every sign-in fail.

   > **TODO (unverified):** where you set the domain of one service in Coolify, and how that changes `SERVICE_URL_WEB`.

5. Optional: set `FREENARY_VERSION` to pin a release, such as `0.1.0`. Unset, both images use the `latest` tag. See [Update Freenary](update-freenary.md).
6. Deploy the resource. The `migrate` service runs once and exits. It carries `exclude_from_hc: true`, a Coolify key that leaves it out of the health status of the resource.

   > **TODO (unverified):** the name of the deploy button in Coolify, and where the panel shows the logs of each container.

7. Open the address in a browser and create the first account. That account becomes the operator, the account that sets up the instance. See [First run and the operator](../explanation/first-run-and-operator.md).

The `server` service in `coolify.yml` lists its environment one variable at a time and loads no `.env` file. A variable you add in Coolify reaches the server only if `coolify.yml` names it. To set another setting, such as `GOOGLE_CLIENT_ID`, add a line `- GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}` under `server` › `environment`, then set the value in Coolify. Bank, email, assistant and categorisation settings need no edit: the operator saves them in the app. See [Where settings come from](../explanation/settings-sources.md).

> **TODO (unverified):** that Coolify restarts the `server` container after it exits. `coolify.yml` sets no `restart` policy, and **Apply now** in **Settings** ends the server process so that a restart reads the saved settings.

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

- Sign-in fails with **Something went wrong. Try again.**, and the `server` log shows `[Better Auth]: Invalid origin: …`. The browser address differs from `SERVICE_URL_WEB`, often `http://` against `https://`. Fix the domain of the `web` service and deploy again.
- The `server` log shows `TRUSTED_PROXIES is not set. …`. Coolify's proxy sits in front of the web app, so every visitor shares one sign-in rate limit. Set `TRUSTED_PROXIES` in Coolify to the address or range of that proxy, as the `web` container sees it. `coolify.yml` passes it to both `server` and `web`.

  > **TODO (unverified):** which Docker network Coolify's proxy and the `web` container share, and its address range.

- The browser shows `Bad Gateway`, or a container stays unhealthy. See [Troubleshoot](troubleshoot.md).

## Related

- [Install with Dokploy](install-with-dokploy.md)
- [Configuration](../reference/configuration.md)
- [Update Freenary](update-freenary.md)
