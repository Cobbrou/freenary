---
title: Connect an AI agent over MCP
description: Give an AI agent such as Claude Code access to your Freenary account through its MCP server.
---

This page connects an AI agent to your Freenary account. The agent talks to Freenary's Model Context Protocol (MCP) server, an endpoint that offers it tools to read your accounts, transactions and budget, and to save dashboards. The agent acts as you, with an API key you create and can revoke.

## Before you start

- A running Freenary instance that the agent's computer can reach, such as `https://freenary.example.com`.
- An account on it that you signed in to less than 15 minutes ago. Creating a key needs a recent sign-in.
- An agent that supports remote MCP servers over Streamable HTTP with a custom header, such as Claude Code.

## Steps

1. In Freenary, open **Settings**, then **API keys**.
2. Select **Create a key**.
3. In **Name**, enter the agent's name, such as `Claude Code`. Pick a duration in **Expires after**, then select **Create key**.
4. Under **Copy your key now**, select **Copy**, then **Done**. Freenary shows the key only once, so store it in your password manager.
5. Add the server to your agent. The URL is your Freenary address followed by `/mcp`, and the key goes in an `Authorization` header. With Claude Code:

   ```bash
   claude mcp add --transport http freenary https://freenary.example.com/mcp \
     --header "Authorization: Bearer fny_your_key"
   ```

   An agent configured with JSON takes the same two values:

   ```json
   {
     "mcpServers": {
       "freenary": {
         "url": "https://freenary.example.com/mcp",
         "headers": { "Authorization": "Bearer fny_your_key" }
       }
     }
   }
   ```

   > **TODO (unverified):** the exact configuration file and key names of each agent other than Claude Code.

6. Restart the agent or start a new conversation, then ask it a question such as "How much did I spend on groceries last month?".

## Check that it works

List the tools with `curl`, replacing the address and the key:

```bash
curl -s -X POST https://freenary.example.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer fny_your_key' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

The answer is a JSON object whose `result.tools` lists `get_accounts_overview`, `get_budget_vs_actual`, `get_cash_flow`, `get_fixed_vs_variable`, `get_recurring_expenses`, `get_spending_by_group`, `save_dashboard` and `search_transactions`. In the agent, the same names show up as the tools of the `freenary` server.

## If something goes wrong

- `401` with the body `unauthorized` → the request carries no key. Check that the header is named `Authorization` and its value starts with `Bearer `.
- `401` with the body `invalid_api_key` → the key was revoked, expired, or copied incompletely. Create a new one.
- `429` with the body `rate_limited` → the key went over its request limit. Wait a minute. [API](../reference/api.md#credentials) gives the limit.
- `403` with the body `forbidden_origin` → the request came from a web page on another site. Call the server from the agent, not from a browser page.
- **Create key** fails with "Sign in again before changing how your account is accessed: this needs a session less than 15 minutes old." → your sign-in is older than that. Sign out, sign in, and create the key again.
- `502 Bad Gateway` → the tool took longer than the web app waits for the API server. See [One address for the browser](../explanation/architecture.md#one-address-for-the-browser). Ask for a shorter period.

## Related

- [MCP server](../reference/mcp-server.md): the endpoint, the tools and their inputs
- [Call the API with an API key](call-the-api.md)
