---
title: Call the API with an API key
description: Create an API key and call Freenary's procedures from a script.
---

This page gets a script talking to your Freenary account. You create an API key, a secret that lets a program act as you, and send it with each request to the API's OpenAPI routes.

## Before you start

- A running Freenary instance, such as `https://freenary.example.com`.
- An account on it that you signed in to less than 15 minutes ago. Creating a key needs a recent sign-in.
- `curl`, or any HTTP client.

## Steps

1. In Freenary, open **Settings**, then **API keys**.
2. Select **Create a key**.
3. In **Name**, enter what will use the key, such as `Budget export`. Pick a duration in **Expires after**, then select **Create key**.
4. Under **Copy your key now**, select **Copy**, then **Done**. Freenary shows the key only once.
5. Call a procedure. Every procedure is a `POST` with a JSON body, at `/api-reference/` followed by its router and name. Send the key as a bearer token:

   ```bash
   curl -s -X POST https://freenary.example.com/api-reference/budget/getAccounts \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer fny_your_key' \
     -d '{}'
   ```

   A procedure with input takes it as the body, such as `-d '{"from":"2026-01-01","to":"2026-01-31"}'` for `budget.getCashFlow`. [API](../reference/api.md#procedures) lists every procedure and its input. `/api-reference/spec.json` is the OpenAPI document, for generating a client.

6. When the script no longer needs access, select **Revoke** next to the key and confirm.

## Check that it works

The `budget.getAccounts` call above prints your accounts as JSON:

```json
{
  "accounts": [],
  "currency": "EUR",
  "firstTransactionDate": null,
  "hasAccounts": false,
  "lastTransactionDate": null
}
```

An account with a connected bank lists its bank accounts in `accounts`. In **Settings** › **API keys**, the key's row now shows **Last used** with today's date.

## If something goes wrong

- `401` with `"code":"UNAUTHORIZED"` → the request carries no key. Check the `Authorization` header, or send the key in an `x-api-key` header instead.
- `401` with the body `invalid_api_key` → the key was revoked, expired, or copied incompletely. Create a new one.
- `403` with `"code":"FORBIDDEN"` → the procedure is an `Operator` procedure, which an API key cannot call. Use the web app for instance settings.
- `403` with the code `API_KEY_NOT_ALLOWED` → the request went to `/api/auth/*`. A key cannot change sign-in, sessions, passkeys or keys.
- `429` with the body `rate_limited` → the key went over its request limit. Wait a minute. [API](../reference/api.md#credentials) gives the limit.
- `415` with the body `unsupported_media_type` → add `-H 'Content-Type: application/json'`.

## Related

- [API](../reference/api.md): every path, credential and procedure
- [Connect an AI agent over MCP](connect-an-ai-agent.md)
