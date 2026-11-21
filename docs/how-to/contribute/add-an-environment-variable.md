---
title: Add an environment variable
description: Declare a new server setting and regenerate the files that list it.
---

This page helps you add a server setting: you declare it once in `packages/env/src/schema.ts`, and `bun run env:sync` writes `.env.example` and the [Configuration](../../reference/configuration.md) page from it. Neither generated file is edited by hand.

## Before you start

- A working clone, as in [Run from source](run-from-source.md).
- The variable is read by the API server. Variables of the web app build (`VITE_*`) live in `packages/env/src/schema-web.ts` instead.

## Steps

1. Open `packages/env/src/schema.ts` and add a key to `serverEnvSchema`, where it falls in the alphabetical order of the keys. Write the Zod type, then `.describe()` with one sentence, then `.meta()`:

   ```ts
   EXAMPLE_TIMEOUT_SECONDS: z.coerce
     .number()
     .int()
     .positive()
     .optional()
     .describe("How long the example request waits before it gives up.")
     .meta({
       example: "30",
       onError: "A value that is not a positive integer stops the start.",
       section: "assistant",
     }),
   ```

   The `.meta()` fields, from the `GlobalMeta` declaration at the end of the file:

   - `section` (required): the section of both generated files. One of the `id` values of `SECTIONS` in `scripts/env-sync.ts`: `core`, `origins`, `database`, `email`, `sign-in`, `bank`, `assistant`, `categorisation`.
   - `example` (required unless `envFile` is `"none"`): the value written in `.env.example`.
   - `onError` (required): what happens when the value is absent or wrong. It fills the **Absent or wrong** column of the reference.
   - `envFile`: `"commented"` (the default) writes `# NAME=example`; `"required"` writes `NAME=example` uncommented; `"none"` leaves the variable out of `.env.example`.
   - `default`: text for the **Default** column, when the Zod default is not what you want to show.
   - `productionRequired`: `true` adds ", required in production" to the default. Pair it with the `devDefault()` helper of the file, which applies a default only outside production.
   - `secret`: `true` marks a value that must stay private.

2. Read the value in code through `env` from `@freenary/env/server`:

   ```ts
   import { env } from "@freenary/env/server";

   const timeoutSeconds = env.EXAMPLE_TIMEOUT_SECONDS;
   ```

   Do not read `process.env.EXAMPLE_TIMEOUT_SECONDS` directly. The generator scans the sources and refuses a variable that nothing declares.

3. Regenerate the two files:

   ```bash
   bun run env:sync
   ```

4. Commit `packages/env/src/schema.ts`, `.env.example` and `docs/reference/configuration.md` together. The `env-sync` pre-commit hook does steps 3 and 4 for you when the schema file is staged (see [Run the checks](run-checks.md#the-commit-hooks)).

### Make it settable in the app

Some settings can also be entered by the operator in the app, on the setup screen and in the settings. The server stores them, and `settings` from `@freenary/instance-config` merges them with the environment.

5. In `packages/instance-config/src/integrations.ts`, add the key to the `fields` of a variant of an integration (banking, email, assistant, categorisation), with a `kind` (`text`, `url`, `secret`, `secret-block`, `port`, `toggle`) and `required`.

6. In the server code, read it through `settings` instead of `env`:

   ```ts
   import { settings } from "@freenary/instance-config";
   ```

7. Give the field a label: add an entry to `FIELD_LABELS` in `apps/web/src/features/instance-integration/model/labels.ts`, and a message key to both `apps/web/messages/en.json` and `apps/web/messages/fr.json`. Without a label the screen shows the raw key.

See [Where settings come from](../../explanation/settings-sources.md) for which value wins.

## Check that it works

```bash
bun run env:check
```

```text
env-sync: <n> declared variables, both artifacts current
```

`<n>` is the number of keys in `serverEnvSchema`, one more than before your change. Your variable now appears in `.env.example` and in its section of [Configuration](../../reference/configuration.md).

## If something goes wrong

`bun run env:sync` prints each problem as `env-sync: <message>` and exits with status 1:

- `<NAME>: no .describe(). One sentence, …` → add `.describe()`.
- `<NAME>: no example in .meta(); .env.example needs one.` → add `example`, or set `envFile: "none"`.
- `<NAME>: no onError in .meta(); the reference needs that column.` → add `onError`.
- `<NAME>: its .meta() section "…" is none of SECTIONS in scripts/env-sync.ts, …` → use one of the section ids above.
- `<file>: reads <NAME> from the environment, and nothing declares it.` → declare it in the schema, or add it to `EXTERNAL` in `scripts/env-sync.ts` with the reason it stays a raw read.
- `<NAME>: declared in scripts/env-sync.ts, and no source or compose file uses it.` → remove the `EXTERNAL` entry, or give it `kind: "inert"`.
- ``<file>: stale. Run `bun run env:sync`.`` (from `env:check`) → run `bun run env:sync` and commit the result.
