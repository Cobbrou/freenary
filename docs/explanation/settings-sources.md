---
title: Where settings come from
description: How environment variables and settings saved from the setup screen combine.
---

This page explains how the Freenary server combines two sources of configuration, which one wins, where saved settings live, and why a saved change needs a restart.

## Two sources

The first source is the environment of the server process. With the Compose stack, that is every line of `.env`, which the `server` service loads whole through `env_file`, plus the few values `docker-compose.yml` sets itself, such as `DATABASE_URL` and `NODE_ENV`.

The second source is settings saved from the app. The operator, the first account created on the instance, saves them on the setup screen or in **Settings** › **Services**. Only four integrations can be saved this way, and only these keys:

- **Bank provider**: `BANKING_PROVIDER`, the three `POWENS_` values and the two `ENABLE_BANKING_` values.
- **Email delivery**: `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY` and the `SMTP_` values.
- **Assistant model**: `AI_BASE_URL`, `AI_MODEL` and `AI_API_KEY`.
- **Categorisation model**: `TRANSACTION_CLASSIFIER`, `TRANSACTION_CLASSIFIER_URL`, `TRANSACTION_CLASSIFIER_MODEL` and `TRANSACTION_CLASSIFIER_API_KEY`.

Every other setting exists in the environment only: secrets, public origins, sign-in providers, the classifier fallback and its tuning, and the dictionary key. [Configuration](../reference/configuration.md) lists them all.

## The environment wins, key by key

A key belongs to the environment when the server process holds a non-empty value for it. A default from the settings schema does not count: when `.env` leaves out `BANKING_PROVIDER`, the default `powens` applies, but the operator can still save another provider.

At start, the server takes the environment and lays the saved settings over it, one key at a time, skipping every key the environment holds. It then checks the result against the same schema that checks `.env`. The rule is per key, so one integration can mix both sources: `.env` can hold the Powens domain while the client secret comes from the app.

## What the screens show

The server tells the screens where each value comes from: the environment, the saved settings, or nowhere.

- When the environment holds the provider choice and every required value, the integration counts as configured by the environment. The setup step and the **Settings** dialog show **Configured through environment variables** and **Set by your server's environment variables.**, with **Test connection** and no form. **Show details** lists the values and the variable names. The default provider counts too, as long as no saved provider replaces it. It adds a line such as **BANKING_PROVIDER is not set, so Powens is the default.** The row in **Settings** reads **Set by your server ·** and the provider, with a **View** button.
- When the environment holds only some values, the form shows those as **Set by your server** rows and asks for the rest.
- Text and URL values from the environment reach the browser shortened to their first four and last four characters, or hidden entirely when they have eight characters or fewer. Secrets never reach the browser. A secret saved earlier shows **Saved. Leave empty to keep it.**, and an empty field keeps it as long as the choice and the endpoint URL stay the same.
- Saving a provider that differs from the one the environment sets is refused with **Your server's environment sets this provider.**

## Where saved settings live

Saved settings live in the `instance_setting` table of the Freenary database, one row per key. Each row holds the sealed value, the time of the last change, and the ID of the operator who made it. One extra row per integration, named `variant:` and the integration, remembers which choice the operator picked. It tells apart choices that share the same values, such as Jev and SubQ Snap, which both use the `system-one` protocol. **Turn off** in **Settings** deletes the rows of that integration.

Only the operator can read or change these settings through the API.

## How saved settings are protected

The server seals every saved value, secret or not, with AES-256-GCM. The key comes from `BETTER_AUTH_SECRET` through HKDF-SHA256. Each value gets a fresh random nonce, and the setting name is bound into the seal, so a sealed value opens only under its own name.

The seal ties saved settings to `BETTER_AUTH_SECRET`. A server started with another secret cannot open them. It logs `The stored value of <KEY> does not open with the current BETTER_AUTH_SECRET.` for each key and runs as if those keys were not saved.

## Settings load once, at start

The server reads saved settings once, when it starts, and keeps them for its whole run.

- If the database cannot be read at that moment, a production server refuses to start. Outside production, the server logs the failure followed by `The environment alone is in force.` and goes on.
- If the saved settings fail the schema check, the server ignores all of them and runs on the environment alone. The setup screen then shows **Configuration problem** and **The stored configuration did not load:** with the reason.
- If the saved classifier cannot be built, the server logs the reason followed by `The stored classifier is ignored, and the environment alone is in force.`

## Saving, testing and applying

**Save** first sends a test to the provider, the same check as **Test connection**. A failed test offers **Save anyway**, which saves and shows **Saved without a connection test.** Saving writes to the database and nothing else: the running server keeps its configuration.

The server compares the saved settings with the ones it loaded at start, ignoring keys the environment holds. When they differ, **Settings** shows **Restart to apply your changes** and **Saved settings take effect after the server restarts. This page reconnects on its own.**

**Apply now** in **Settings**, and **Finish setup** on the setup screen, ask the server to complete the setup. Both refuse while no bank provider is configured. When a saved change is waiting, the server answers, then ends its own process 250 milliseconds later. The server does not start itself again. In the Compose stack, `restart: unless-stopped` on the `server` service makes Docker start the container again, and the new process reads the saved settings afresh.

Meanwhile the page shows **Applying your settings…** and **This page reconnects on its own.** Every two seconds, it asks the server whether a restart is still pending. When the answer is no, **Settings** shows **Settings applied**, and the setup screen shows **The instance is set up.** If no answer comes within 60 seconds, the page shows **The server did not restart** and **It did not answer within one minute.** That happens when nothing restarts the server process.

A change to `.env` follows another path: `docker compose up -d` recreates the server container, which reads the new environment at start.

## Related

- [First run and the operator](first-run-and-operator.md)
- [Configuration](../reference/configuration.md)
- [Configure Powens](../how-to/configure-powens.md)
