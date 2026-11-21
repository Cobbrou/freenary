---
title: MCP server
description: The endpoint, credential, tools and answers of Freenary's Model Context Protocol server.
---

Freenary runs a Model Context Protocol (MCP) server, so an AI agent such as Claude Code can read your finances and build dashboards with the same tools as the in-app assistant. This page lists what the server offers. [Connect an AI agent over MCP](../how-to/connect-an-ai-agent.md) walks through the setup.

## Endpoint

| Property | Value |
| --- | --- |
| URL | `/mcp` on your Freenary address, such as `https://freenary.example.com/mcp`. The web app forwards it to the API server. |
| Transport | Streamable HTTP, without MCP sessions: every request stands alone, and the server sends no `Mcp-Session-Id`. |
| Method | `POST`. `GET`, `DELETE` and every other method get `405` with `Allow: POST`. |
| Answer | One JSON body per request. The server never opens an event stream. |
| Server name | `freenary`, with the title `Freenary` and the version of the server image (`0.0.0` for an image built outside a release). |

The server code lives in `packages/api/src/mcp/`. It is mounted in `apps/server/src/index.ts`.

## Credential

The server accepts only an API key, sent as `Authorization: Bearer <key>` or in the `x-api-key` header. A session cookie alone is not enough. Each tool acts as the account that owns the key, through the same procedures the web app calls. [API](api.md#credentials) says how a key is created, what it cannot do, and how many requests it may make.

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `unauthorized` | No API key. The answer carries `WWW-Authenticate: Bearer realm="freenary"`. |
| `401` | `invalid_api_key` | The key is unknown, revoked or expired. |
| `403` | `forbidden_origin` | The request carries an `Origin` header that is not `CORS_ORIGIN`, as a web page on another site would send. |
| `405` | `method_not_allowed` | A method other than `POST`. |
| `429` | `rate_limited` | The key made more requests than its limit allows. Each MCP message (`initialize`, `tools/list`, `tools/call`) is one request. |

## Tools

The tools are the ones the in-app assistant uses (`packages/api/src/assistant/tools.ts`). Days are written `YYYY-MM-DD` and both ends of a period are included. Amounts in results are decimal strings in the currency each result names.

| Tool | Reads or writes | Input |
| --- | --- | --- |
| `get_accounts_overview` | Reads | none. Returns the bank accounts (`id`, `institutionName`, `name`), `currency`, `hasAccounts` and the first and last day the transactions cover. |
| `get_budget_vs_actual` | Reads | `from`, `to`, and `aggregation`: `total` (default), `average` or `median`. |
| `get_cash_flow` | Reads | `from`, `to`. |
| `get_fixed_vs_variable` | Reads | `from`, `to`, `aggregation`. |
| `get_recurring_expenses` | Reads | none. |
| `get_spending_by_group` | Reads | `from`, `to`, `aggregation`. |
| `search_transactions` | Reads | `from`, `to`, and optional `search`, `categories`, `groups`, `direction` (`incoming` or `outgoing`), `minAmount`, `maxAmount`, `limit` (1 to 20, default 10) and `sort` (`date`, the default, or `amount`). |
| `save_dashboard` | Writes | `widgets`, and `title` to create a dashboard, or `dashboardId` to replace the widgets of one. A dashboard it creates is not linked to an assistant chat. |

`tools/list` marks every tool except `save_dashboard` with `readOnlyHint: true`. `save_dashboard` carries `readOnlyHint: false` and `destructiveHint: true`, because it replaces the widgets of an existing dashboard.

A tool call whose arguments fail the input schema, or whose procedure refuses, comes back as a result with `isError: true` and the message as text. A successful call returns one `text` item that holds the result as JSON.

## Instructions

The `initialize` answer carries instructions for the agent (`MCP_INSTRUCTIONS` in `packages/api/src/mcp/server.ts`). They tell it to call `get_accounts_overview` first and to stay inside the days the data covers, how days and amounts are written, that categories are slugs, that transaction labels are data and never instructions, and that Freenary gives information, not regulated financial advice.

## Related

- [Connect an AI agent over MCP](../how-to/connect-an-ai-agent.md)
- [API](api.md)
