---
title: Enable the assistant
description: Connect an OpenAI-compatible model so the assistant can answer.
---

This page connects the assistant, the chat behind **Ask** that answers questions and builds dashboards, to a model your server calls. Freenary talks to any endpoint that speaks the OpenAI chat-completions format, such as OpenRouter, Ollama or vLLM. You can set this up in **Settings** or in `.env`. If both hold a value for the same setting, the value in `.env` wins. The setup screen has no assistant step. [How the assistant finds a model](../explanation/assistant.md) describes what happens without one.

## Before you start

- Freenary runs, and you can sign in as the operator. The operator is the account that claimed the instance (see [First run and the operator](../explanation/first-run-and-operator.md)), and only the operator sees the **Services** list in **Settings**.
- To use **Settings**, you finished your own onboarding by connecting a bank: until then every page of the app, including **Settings**, sends you back to onboarding. See [First run and the operator](../explanation/first-run-and-operator.md#onboarding). The `.env` way works at any time.
- You have the base URL of the endpoint, with its version path, for example `https://openrouter.ai/api/v1`. Freenary adds `/chat/completions` to it.
- You have the model ID as that endpoint names it, for example `anthropic/claude-3.5-sonnet`, and an API key if the endpoint asks for one. A local endpoint may need no key.

## Steps

### In the app

1. Open **Settings** › **Services**. Find **Assistant model** and select **Set up**.
2. Select **OpenAI-compatible endpoint**, then select **Continue**.
3. Enter the endpoint in **Base URL** and the model ID in **Model**.
4. If the endpoint needs a key, open **More options** and paste it in **API key**.
5. Select **Save**. Freenary first sends the model a short test prompt, then saves the settings.
6. Select **Apply now** in the **Restart to apply your changes** notice. The page shows **Applying your settings…** while the server restarts.

### In `.env`

1. Add the endpoint to `.env`. `AI_BASE_URL` and `AI_MODEL` are both required. Leave out `AI_API_KEY` for an endpoint that takes no key.

   ```dotenv
   AI_BASE_URL=https://openrouter.ai/api/v1
   AI_MODEL=anthropic/claude-3.5-sonnet
   AI_API_KEY=sk-...
   ```

   See [Configuration](../reference/configuration.md#assistant).

2. Recreate the server container so it reads the new values:

   ```bash
   docker compose up -d
   ```

## Check that it works

1. In **Settings** › **Services**, the **Assistant model** row reads **Configured · OpenAI-compatible endpoint**, or **Set by your server · OpenAI-compatible endpoint** when the values come from `.env`.
2. Open **Ask**, then open the model menu. It lists your model ID under **On your instance**. A member who has not picked a device model gets it by default.
3. Ask a question. The answer comes from your model.

## If something goes wrong

- **OpenAI-compatible endpoint refused these credentials. Check them and try again.** The endpoint answered the test with an error. Check the key and the model ID. **Show details** holds the answer. **Save anyway** saves without the test.
- **Unable to reach OpenAI-compatible endpoint. Check the address and your network, then try again.** The server could not reach `<Base URL>/chat/completions`. Check that the URL ends with the version path, such as `/v1`, and that the server container can reach it.
- **A value has the wrong format. Check the fields and try again.** The base URL is not a URL, or the endpoint answered with no `choices`. Check the URL and the model ID.
- The server stops at start after you set `AI_BASE_URL`. The value is not a URL. Write the full address, starting with `http://` or `https://`.
- **This instance has no model configured. The operator turns the assistant on in Settings › Services.** The server answered `unconfigured`: it holds only one of `AI_BASE_URL` and `AI_MODEL`, or the change is saved but not applied yet. Set both, then select **Apply now** or run `docker compose up -d`.
- **Too many questions in a row. Wait a moment and try again.** Each member can send 30 questions in 5 minutes. Wait and ask again.
- **The server did not restart** and **It did not answer within one minute.** Run `docker compose ps` and `docker compose logs server`, then `docker compose up -d`, and select **Try again**.

## Related

- [How the assistant finds a model](../explanation/assistant.md)
- [Enable transaction categorisation](enable-transaction-categorisation.md)
- [Where settings come from](../explanation/settings-sources.md)
- [Configuration](../reference/configuration.md#assistant)
