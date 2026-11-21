---
title: Self-host on a server
description: Run Freenary on a Linux server under your own domain, with HTTPS.
---

In this tutorial you put Freenary on a Linux server so you can reach it at your own address, for example `https://freenary.example.com`. You use the same Compose file as in [Get it running](get-it-running.md), and add [Caddy](https://caddyserver.com/), a web server that gets an HTTPS certificate for your domain by itself.

You end with Freenary answering over HTTPS, its plain-HTTP port closed to the network, and your operator account on the setup screen.

Replace `freenary.example.com` with your own domain everywhere on this page.

## Before you start

You need:

- **A Linux server** with a public IP address, that you can reach with SSH. A user with `sudo` rights is enough.
- **A domain name** whose DNS you can edit.
- **Ports 80 and 443 open** to the internet, with nothing else listening on them on the server. Caddy uses port 80 to prove to the certificate authority that you own the domain, and port 443 for HTTPS.
- **Docker Engine with the Compose plugin** on the server. Install both from [docs.docker.com/engine/install](https://docs.docker.com/engine/install/), then check:

  ```bash
  docker compose version
  ```

  The output starts with `Docker Compose version v2` or a higher version number.

It helps to have run [Get it running](get-it-running.md) once on your own computer, but it is not required.

## 1. Point your domain at the server

1. In your DNS provider's dashboard, create an `A` record for `freenary.example.com` with your server's IPv4 address. If the server has an IPv6 address, add an `AAAA` record too.
2. Wait until the record is visible. From your server or your own computer, run:

   ```bash
   nslookup freenary.example.com
   ```

   The `Address` line at the end of the output is your server's IP address. If it is empty or shows another address, wait a few minutes and try again. Do not go on until it is right: Caddy cannot get a certificate before.

## 2. Download the Compose file

On the server:

```bash
mkdir -p ~/freenary
cd ~/freenary
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/suiramdev/freenary/main/docker-compose.yml
```

Every command from now on runs in `~/freenary` on the server.

## 3. Create the `.env` file

```bash
cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 16)
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
BETTER_AUTH_URL=https://freenary.example.com
CORS_ORIGIN=https://freenary.example.com
WEB_PORT=127.0.0.1:3001
EOF
```

What each line does:

| Line | Effect |
| --- | --- |
| `POSTGRES_PASSWORD` | The database password. |
| `BETTER_AUTH_SECRET` | Signs sign-in cookies and encrypts settings you save in the app. Keep it with your backups. |
| `BETTER_AUTH_URL` | The public address of the API. The web app passes API requests on, so it is the same address as the web app. An `https://` value marks the session cookie `Secure`. |
| `CORS_ORIGIN` | The public address of the web app. The browser address must match it exactly, or sign-in fails. |
| `WEB_PORT` | Publishes the web app on `127.0.0.1:3001` only. Without it, port `3001` is open to the whole network over plain HTTP, next to Caddy. |

Both addresses have no trailing slash. [Configuration](../reference/configuration.md#public-origins-and-cookies) lists every related setting.

## 4. Add Caddy

Create a file named `docker-compose.override.yml` next to `docker-compose.yml`. Compose reads it automatically and merges it with the main file.

```bash
cat > docker-compose.override.yml <<'EOF'
services:
  caddy:
    image: caddy:2
    restart: unless-stopped
    command: caddy reverse-proxy --from freenary.example.com --to web:3001
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - web

volumes:
  caddy_data:
  caddy_config:
EOF
```

Remember to replace `freenary.example.com` in the `command:` line. Caddy receives every request on ports 80 and 443 and passes it to the `web` service over Docker's internal network. The `caddy_data` volume keeps the certificate between restarts.

## 5. Start the stack

```bash
docker compose up -d --wait
```

The command returns once every service is ready, and exits without an error. The last lines name `freenary-web-1`, `freenary-server-1`, `freenary-postgres-1` and `freenary-caddy-1`.

Check the containers:

```bash
docker compose ps -a
```

Expect `Up` for `caddy`, `Up … (healthy)` for `postgres`, `server` and `web`, and `Exited (0)` for `migrate`. In the `PORTS` column, `web` shows `127.0.0.1:3001->3001/tcp`, not `0.0.0.0:3001`.

## 6. Tell Freenary to trust Caddy

The web app sees every visitor as Caddy's address unless you tell it that Caddy is a proxy. Then all visitors share one sign-in rate limit, and the server log says `TRUSTED_PROXIES is not set`.

1. Find the address range of the stack's Docker network:

   ```bash
   docker network inspect freenary_default --format '{{(index .IPAM.Config 0).Subnet}}'
   ```

   The output is a range such as `172.19.0.0/16`. Yours can differ.

2. Add it to `.env`, with your own value:

   ```bash
   echo "TRUSTED_PROXIES=172.19.0.0/16" >> .env
   ```

3. Apply the change:

   ```bash
   docker compose up -d --wait
   ```

   Compose recreates the containers whose settings changed.

## 7. Check that it works

1. Check the certificate. Caddy asks for it the first time it starts, which can take a minute:

   ```bash
   docker compose logs caddy
   ```

   > **TODO (unverified):** this tutorial was tested with Caddy on plain HTTP only. Confirm the log line Caddy prints once it has the certificate, for example `certificate obtained successfully`.

2. Check HTTPS and the path to the API server, from your own computer:

   ```bash
   curl -s https://freenary.example.com/api/auth/ok
   ```

   Expected output: `{"ok":true}`.

3. Check that the plain-HTTP port is closed from outside. From your own computer, replace `203.0.113.10` with your server's IP address:

   ```bash
   curl -s -m 5 -o /dev/null -w '%{http_code}\n' http://203.0.113.10:3001/
   ```

   Expected output: `000`, which means no answer.

4. Read the server log:

   ```bash
   docker compose logs server
   ```

   The line `Server is running on https://freenary.example.com` appears. After the restart in step 6, the `TRUSTED_PROXIES is not set` warning no longer appears. On a new instance, the log also says `This instance has no operator yet.`

## 8. Create the first account

1. Open `https://freenary.example.com`.
2. Select **No account yet? Create one**, enter your email, your name and a password, then select **Create account**.

The first account becomes the operator, and the browser opens the setup screen with the **Bank provider** page. Create your account right after the start: until someone does, anyone who reaches the address can become the operator. See [First run and the operator](../explanation/first-run-and-operator.md).

## You're done

Freenary runs on your server under your domain, over HTTPS.

Next:

- [Connect your first bank](connect-your-first-bank.md) to finish the setup screen.
- [Back up and restore](../how-to/back-up-and-restore.md) to save your database and `.env`.
- [Update Freenary](../how-to/update-freenary.md) when a new release comes out.
- [Configure email](../how-to/configure-email.md) so Freenary can send sign-in codes and password resets.

## If something goes wrong

- **`curl` to your domain fails, and `docker compose logs caddy` shows errors about the certificate.** The DNS record is wrong or not visible yet, or port 80 or 443 is blocked by a firewall or your hosting provider. Check [step 1](#1-point-your-domain-at-the-server) and your firewall, then run `docker compose restart caddy`.
- **`Bind for 0.0.0.0:80 failed: port is already allocated`.** Another web server (for example nginx or Apache) runs on the server. Stop it, or use [Use an existing reverse proxy](../how-to/use-an-existing-reverse-proxy.md) to put Freenary behind it instead.
- **Creating the account fails with Something went wrong. Try again.** The address in the browser differs from `CORS_ORIGIN`, for example `http://` instead of `https://`, or `www.` added. Fix `.env` and run `docker compose up -d --wait`.
- **`web` shows `0.0.0.0:3001->3001/tcp`.** `WEB_PORT` is missing from `.env`. Add `WEB_PORT=127.0.0.1:3001`, then run `docker compose up -d --wait`.

[Troubleshoot](../how-to/troubleshoot.md) covers more cases.
