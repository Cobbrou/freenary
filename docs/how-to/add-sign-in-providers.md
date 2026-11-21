---
title: Add sign-in providers
description: Add Google, Apple or OpenID Connect sign-in buttons.
---

This page adds sign-in buttons for Google, Apple, or your own identity provider through OpenID Connect (OIDC), the standard most single sign-on services speak. Sign-in providers live in `.env` only: the setup screen and **Settings** have no field for them. Each provider adds its button once both of its required values are set.

## Before you start

- Freenary runs, and you can edit its `.env` file.
- You know `BETTER_AUTH_URL`, the public origin the provider sends members back to. `docker-compose.yml` sets it to `http://localhost:3001` when `.env` leaves it out. The web app forwards `/api/auth` to the server, so the callback URLs below work on that origin.
- You can create an OAuth client in the provider's console. An OAuth client is the record that holds a client ID, a client secret and the allowed redirect URIs.

Each provider sends members back to one redirect URI. Register it exactly as written, with your own `BETTER_AUTH_URL` in front:

| Provider | Redirect URI | Button |
| --- | --- | --- |
| Google | `<BETTER_AUTH_URL>/api/auth/callback/google` | **Continue with Google** |
| Apple | `<BETTER_AUTH_URL>/api/auth/callback/apple` | **Continue with Apple** |
| OpenID Connect | `<BETTER_AUTH_URL>/api/auth/callback/oidc` | **Continue with single sign-on**, or **Continue with** and the name in `OIDC_PROVIDER_NAME` |

## Steps

1. In the provider's console, create an OAuth client and add the redirect URI from the table.

   > **TODO (unverified):** the console steps for each provider: the Google Cloud OAuth client, the Apple Services ID and how you produce its client secret, and the client settings in your identity provider.

2. Add the values for each provider you want to `.env`. For Google:

   ```dotenv
   GOOGLE_CLIENT_ID=000000000000-xxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
   ```

   For Apple, the client secret is a signed token, and `APPLE_APP_BUNDLE_IDENTIFIER` is optional: it sets the audience of Apple identity tokens.

   ```dotenv
   APPLE_CLIENT_ID=com.example.freenary
   APPLE_CLIENT_SECRET=eyJhbGciOiJFUzI1NiIsImtpZCI6...
   APPLE_APP_BUNDLE_IDENTIFIER=com.example.freenary
   ```

   For OpenID Connect, point `OIDC_DISCOVERY_URL` at the provider's `.well-known/openid-configuration` document. Freenary always asks for the `openid`, `email` and `profile` scopes, and `OIDC_SCOPES` adds more, separated by commas. Leave out `OIDC_CLIENT_SECRET` for a public client.

   ```dotenv
   OIDC_DISCOVERY_URL=https://idp.example.com/.well-known/openid-configuration
   OIDC_CLIENT_ID=freenary
   OIDC_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
   OIDC_PROVIDER_NAME=Example SSO
   ```

   See [Configuration](../reference/configuration.md#sign-in).

3. Recreate the server container so it reads the new values:

   ```bash
   docker compose up -d
   ```

## Check that it works

1. Ask the server which providers it offers:

   ```bash
   curl -s -X POST -H 'content-type: application/json' http://localhost:3001/api-reference/auth/capabilities
   ```

   The `oauth` list names each provider, for example `"oauth":[{"id":"google","name":null},{"id":"oidc","name":"Example SSO"}]`. With no provider set, it reads `"oauth":[]`.

2. Sign out. The sign-in screen shows one button per provider. Select one, sign in at the provider, and check that you land back in Freenary.

## If something goes wrong

- No button appears. A provider needs both of its values: `GOOGLE_CLIENT_ID` with `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID` with `APPLE_CLIENT_SECRET`, or `OIDC_DISCOVERY_URL` with `OIDC_CLIENT_ID`. One alone adds nothing. Check that you ran `docker compose up -d` after the edit.
- The server stops at start after you set `OIDC_DISCOVERY_URL`. The value is not a URL. Write the full `https://` address of the discovery document.
- The provider rejects the sign-in with a redirect URI error. The redirect URI it received does not match the one you registered, because `BETTER_AUTH_URL` differs from the origin in the console. Make them match, including `http` or `https` and the port.

  > **TODO (unverified):** the exact error text Google, Apple and common identity providers show for a redirect URI mismatch.

## Related

- [Configure email](configure-email.md)
- [Configuration](../reference/configuration.md#sign-in)
- [Configuration: public origins and cookies](../reference/configuration.md#public-origins-and-cookies)
