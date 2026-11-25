---
title: Add a bank provider
description: Implement the BankingProvider interface, register it and make it selectable on the setup screen.
---

This page helps you add a bank provider: a service that connects bank accounts and returns their transactions, like Powens and Enable Banking. You implement one interface in `packages/api`, register it, declare its settings, and give the setup screen its labels.

In the steps, `<id>` is the provider id, such as `powens` or `enable-banking`. The same string is the provider's key in the registry, the value of `BANKING_PROVIDER`, the variant id on the setup screen and the last segment of its callback path.

## Before you start

- A working clone, as in [Run from source](run-from-source.md). The `mock` provider in `packages/api/src/providers/mock` is the smallest complete example.
- You know how to add a setting: [Add an environment variable](add-an-environment-variable.md).

## Steps

1. Create `packages/api/src/providers/<id>/index.ts` and export an object of type `BankingProvider` from `packages/api/src/providers/types.ts`. It needs these members:

   - `id`: `"<id>"`.
   - `callbackPath`: `"/callback/<id>"`. The server sends the bank's consent page `${CORS_ORIGIN}${callbackPath}` as the redirect URL, and the web route `/callback/$provider` (`apps/web/src/app/routes/callback/$provider.tsx`) receives it for every provider.
   - `isConfigured`: `true` when the credentials are present. Powens and Enable Banking read them from `settings` of `@freenary/instance-config` in their `client.ts`.
   - `listInstitutions(country)`: an `Effect` that returns `ProviderInstitution[]`, or fails with `BankInstitutionsUnavailable`.
   - `startConnection(request)`: returns `{ url }`, the consent page to send the user to. It must carry `request.redirectUrl` and `request.state`. When `request.providerSessionId` is set, the user reconnects that connection: return the page that reopens it if the provider has one, or a new consent page.
   - `completeConnection(request)`: reads `request.callbackParams` (the query string of the callback) and returns a `CompletedConnection` with its accounts. `request.providerSessionId` is set for a reconnection. If the account ids differ from the first consent, return each account's `identificationHash` or `iban`, so `packages/api/src/lib/reopen-connection.ts` finds the stored account.
   - `closeConnection(request)` and `fetchTransactions(request)`.
   - `needsReconnect(cause)`: `true` when an error thrown by `fetchAccounts` or `fetchTransactions` says that only the user can repair the connection, such as an expired consent. The connection then becomes `EXPIRED` and syncs skip it. Return `false` for a temporary failure.

   Optional members: `createUser` and `deleteUser` for a provider that scopes data per user (Powens does; the identity is stored in the `BankProviderUser` table), `fetchAccounts` for balances and `fetchHoldings` for investment positions. Amounts are in minor units (`amountMinor`, `balanceMinor`).

2. Register the provider in `packages/api/src/providers/registry.ts`:

   ```ts
   const providers: Record<string, BankingProvider> = {
     [enableBankingProvider.id]: enableBankingProvider,
     [exampleProvider.id]: exampleProvider,
     [powensProvider.id]: powensProvider,
     ...developmentOnlyProviders,
   };
   ```

3. Add `<id>` to the `BANKING_PROVIDER` enum in `packages/env/src/schema.ts`, and update its `.describe()` sentence:

   ```ts
   BANKING_PROVIDER: z.enum(["powens", "enable-banking", "example", "mock"]);
   ```

   Declare each credential the provider needs as a new key of the same schema, with `section: "bank"` in `.meta()`, then run `bun run env:sync`. [Add an environment variable](add-an-environment-variable.md) has the details.

4. Add a variant to `bankingIntegration` in `packages/instance-config/src/integrations.ts`, so the operator can pick the provider and type its credentials on the setup screen and in the settings:

   ```ts
   {
     discriminantValue: "example",
     fields: [
       { key: "EXAMPLE_CLIENT_ID", kind: "text", required: true },
       { key: "EXAMPLE_CLIENT_SECRET", kind: "secret", required: true },
     ],
     id: "example",
   },
   ```

   `kind` is one of `text`, `url`, `secret`, `secret-block`, `port`, `toggle`.

5. Write the credential check in `packages/api/src/providers/<id>/probe.ts`: an `Effect` that fails with `IntegrationProbeFailed` from `@freenary/instance-config/probe` (`integrationId: "banking"`, `variantId: "<id>"`, and a `reason` of kind `unreachable`, `rejected` or `invalid`). Wrap each `fetch` signal in `probeDeadline`, which stops it after 10 seconds. Then add `"banking:<id>"` to the `probes` map in `packages/api/src/instance/probes.ts`. `packages/api/src/providers/powens/probe.ts` is an example.

6. Give the setup screen its text, in `apps/web/src/features/instance-integration/model/labels.ts`:

   - `VARIANT_LABELS`: the provider name (required; without it the screen shows the raw id).
   - `FIELD_LABELS` and `FIELD_HELP`: a label and help for each credential.
   - `REDIRECT_HELP`: what to do with the redirect URL the screen shows.
   - `VARIANT_DESCRIPTIONS` (key `banking:<id>`) and `VARIANT_GUIDE_PATHS` (a page of this documentation), if you want them.

   Each label is a message: add its key to both `apps/web/messages/en.json` and `apps/web/messages/fr.json`.

7. To ask for the credentials one at a time, like **Connect Powens** does, add a sequence for `<id>` to `SEQUENCES` in `apps/web/src/features/instance-integration/model/credential-steps.ts`, with a `REDIRECT_STEP` where the redirect URL belongs. Without a sequence, the screen shows all the fields together.

8. Write tests next to the code, named `*.test.ts`, as the `map-*.test.ts` files of Powens and Enable Banking do for the provider's responses.

## Check that it works

1. Run the API tests:

   ```bash
   cd packages/api && bun test
   ```

2. Run the type check. It fails if your provider object misses a member of `BankingProvider`:

   ```bash
   bun run check-types
   ```

3. Start the stack (see [Run from source](run-from-source.md)), create the first account, and open the **Bank provider** step of the setup screen. Your provider is listed under the label you gave it. Fill in its credentials; the screen shows `http://localhost:3001/callback/<id>` as the redirect URL on the local path. Connect a bank: after the consent page, the browser comes back to `/callback/<id>` and lists the accounts.

> **TODO (unverified):** the provider's own console steps (creating an application, registering the redirect URL) depend on the provider and are not in this repository.

## If something goes wrong

- `Unknown banking provider: <id>` in the server output → the provider is missing from `providers` in `registry.ts`.
- The server refuses to start, with an error on `BANKING_PROVIDER` → `<id>` is missing from the enum in `packages/env/src/schema.ts`.
- The credential check answers `NOT_IMPLEMENTED` with `No check exists` → `"banking:<id>"` is missing from `probes` in `packages/api/src/instance/probes.ts`.
- After the consent page, the toast says "The bank sent back an incomplete response." → the callback query string has no `state`. `startConnection` must pass `request.state` to the provider, which sends it back.
- After the consent page, the toast says "Bank connection failed. You can try again." → the code exchange failed on the server. If the last segment of `callbackPath` differs from `id`, the server refuses it with `Unknown banking provider`; otherwise `completeConnection` threw.

## Related

- [Configure Powens](../configure-powens.md)
- [Configure Enable Banking](../configure-enable-banking.md)
- [Where settings come from](../../explanation/settings-sources.md)
- [Bank provider settings](../../reference/configuration.md#bank-providers)
