---
title: Use an existing reverse proxy
description: Run the stack that publishes no host port, behind Caddy or nginx.
---

This page puts Freenary behind a reverse proxy you already run in Docker, such as Caddy or nginx. A reverse proxy is the server that receives the visitors' HTTPS requests and passes them on to the right container. You run `deploy/docker-compose.yml`, which publishes no host port, and route one public hostname to the `web` service on port `3001`. The web app forwards the API paths (`/api/auth`, `/rpc`, `/ai/chat` and `/api-reference`) to the `server` service, so the browser sees a single address.

## Before you start

- Your reverse proxy runs in a Docker container, and you know the Docker network it is attached to. This page calls it `proxy`. To list the networks of a container, run `docker inspect <container> --format '{{range $name, $net := .NetworkSettings.Networks}}{{$name}} {{end}}'`.
- A hostname, such as `freenary.example.com`, points at the server.

If your proxy runs on the host instead of in a container, use the root `docker-compose.yml`. It publishes the web app on port `WEB_PORT` (default `3001`), and you set `BETTER_AUTH_URL` and `CORS_ORIGIN` to the public address in `.env`.

## Steps

1. Create a folder and download the stack:

   ```bash
   mkdir ~/freenary && cd ~/freenary
   curl -fsSLO https://raw.githubusercontent.com/suiramdev/freenary/main/deploy/docker-compose.yml
   ```

2. Create `.env` with the three required values. `FREENARY_URL` is the public address of the web app, exactly as the browser shows it:

   ```bash
   cat > .env <<EOF
   FREENARY_URL=https://freenary.example.com
   POSTGRES_PASSWORD=$(openssl rand -hex 16)
   BETTER_AUTH_SECRET=$(openssl rand -hex 32)
   EOF
   ```

   `FREENARY_URL` fills `BETTER_AUTH_URL`, `CORS_ORIGIN` and `PUBLIC_SERVER_URL`. See [Configuration](../reference/configuration.md#public-origins-and-cookies).

3. Attach the `web` service to the network of your proxy. Create `docker-compose.override.yml` next to `docker-compose.yml`. Compose reads it on its own:

   ```yaml
   services:
     web:
       networks:
         proxy:
           aliases:
             - freenary-web

   networks:
     proxy:
       external: true
   ```

   The alias `freenary-web` gives the proxy a name that no other stack on the network uses.

4. Start the stack:

   ```bash
   docker compose up -d
   ```

5. Route the hostname to `freenary-web:3001` in your proxy. For Caddy, which gets the HTTPS certificate on its own, add this to the `Caddyfile`:

   ```text
   freenary.example.com {
   	reverse_proxy freenary-web:3001
   }
   ```

   For nginx, with your certificate files:

   ```text
   server {
       listen 80;
       server_name freenary.example.com;
       return 301 https://$host$request_uri;
   }

   server {
       listen 443 ssl;
       server_name freenary.example.com;

       ssl_certificate     /etc/nginx/certs/fullchain.pem;
       ssl_certificate_key /etc/nginx/certs/privkey.pem;

       location / {
           proxy_pass http://freenary-web:3001;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

   Reload the proxy.

   > **TODO (unverified):** the Traefik labels for the `web` service. Also check whether nginx needs `proxy_buffering off;` for the assistant's streamed answers on `/ai/chat`.

6. Find the address range of the `proxy` network:

   ```bash
   docker network inspect proxy --format '{{(index .IPAM.Config 0).Subnet}}'
   ```

   It prints a range such as `172.21.0.0/16`.

7. Add that range to `.env` as `TRUSTED_PROXIES`. The web app then takes the visitor's address from `X-Forwarded-For` behind the proxy, and the sign-in rate limits count each visitor apart:

   ```dotenv
   TRUSTED_PROXIES=172.21.0.0/16
   ```

8. Apply the change:

   ```bash
   docker compose up -d
   ```

## Check that it works

1. Ask the API through the proxy:

   ```bash
   curl https://freenary.example.com/api/auth/ok
   ```

   The answer is `{"ok":true}`.

2. Read the server log:

   ```bash
   docker compose logs server
   ```

   It shows `Server is running on https://freenary.example.com`, and neither `TRUSTED_PROXIES is not set.` nor `[auth] BETTER_AUTH_URL (…) is plain HTTP`.

## If something goes wrong

- `docker compose up -d` stops with `Error response from daemon: network proxy not found`. The network name in `docker-compose.override.yml` differs from your proxy's network. Use the name `docker inspect` printed.
- The server log shows `[auth] BETTER_AUTH_URL (http://…) is plain HTTP, so the session cookie has no Secure flag …`. `FREENARY_URL` starts with `http://`. Set it to the `https://` address and run `docker compose up -d`.
- Sign-in fails with **Something went wrong. Try again.**, and the server log shows `[Better Auth]: Invalid origin: …`. The browser address differs from `FREENARY_URL`. Set `FREENARY_URL` to that exact address.
- The browser shows `Bad Gateway`. The web app could not reach the server. See [Troubleshoot](troubleshoot.md#the-browser-shows-an-error).
- You do not need `AUTH_COOKIE_DOMAIN` here: `FREENARY_URL` puts the web app and the API on one hostname. It matters only when `BETTER_AUTH_URL` and `CORS_ORIGIN` have different hostnames. Then the server refuses to start over plain HTTP with `The API (…) and the web app (…) are on different hosts, so the session cookie needs SameSite=None — which browsers reject over plain HTTP. …`, and refuses an `AUTH_COOKIE_DOMAIN` that is not a parent of both hostnames with `AUTH_COOKIE_DOMAIN (…) is not a parent of both … and …`.

## Related

- [Compose files](../reference/compose-files.md#deploydocker-composeyml)
- [Install with Dokploy](install-with-dokploy.md)
- [Back up and restore](back-up-and-restore.md)
