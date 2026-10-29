# Data model

Every Prisma model by area, every enum value, the money representation, the migrations and the schema loop.

This file owns the vocabulary of the schema. Every model name, column name and enum value below comes from `packages/db/prisma/schema/`. Other docs link here instead of repeating a Prisma name.

## Where the schema lives

Prisma reads a directory, not one file. Six files split the model by area.

```text
packages/db/
  prisma/
    schema/
      schema.prisma
      auth.prisma
      budget.prisma
      budget-profile.prisma
      assistant.prisma
      instance.prisma
    migrations/
      12 migration directories, migration_lock.toml, .gitkeep
  prisma.config.ts
```

`schema.prisma` carries the generator and the datasource and no model.

| Setting             | Value                                             |
| ------------------- | ------------------------------------------------- |
| generator provider  | `prisma-client`                                   |
| client output       | `../generated`, so `packages/db/prisma/generated` |
| `moduleFormat`      | `esm`                                             |
| `runtime`           | `bun`                                             |
| `previewFeatures`   | `["postgresqlExtensions"]`                        |
| datasource provider | `postgresql`                                      |
| `extensions`        | `[citext]`                                        |
| datasource `url`    | **absent from the schema**                        |

Two places supply the URL. `packages/db/prisma.config.ts` hands `process.env.DATABASE_URL || undefined` to the CLI, and it loads `apps/server/.env` with dotenv. `packages/db/src/index.ts` builds `PrismaPg` from `env.DATABASE_URL` at runtime. That file exports the `Prisma` namespace, the `createPrismaClient` factory and the default singleton. `prisma.config.ts` also sets `schema` to `prisma/schema` and `migrations.path` to `prisma/migrations`.

## Identity and sign-in

`auth.prisma` holds seven models. Better Auth writes them, and `packages/auth` configures the plugins that do it.

| Model and table | Key fields | Constraints and notes |
| --- | --- | --- |
| `User`, table `user` | `id`, `name`, `email`, `emailVerified` (`false`), `twoFactorEnabled` (`false`), `image?`, `taxCountries String[]`, `onboardingCompletedAt?`, `role UserRole` (`MEMBER`), `createdAt`, `updatedAt` | `@@unique([email])`. Ten child relations, each with a cascade delete. Better Auth never writes `role` |
| `Session`, table `session` | `expiresAt`, `token`, `ipAddress?`, `userAgent?`, `userId` | `@@unique([token])`, `@@index([userId])`, cascade |
| `Account`, table `account` | `issuer`, `accountId`, `providerId`, `userId`, `accessToken?`, `refreshToken?`, `idToken?`, `accessTokenExpiresAt?`, `refreshTokenExpiresAt?`, `scope?`, `password?` | `@@unique([issuer, accountId], map: "account_issuer_accountId_uidx")`, `@@index([userId])`. The credential and OAuth link table, never a bank account. The password hash sits in `password` |
| `Verification`, table `verification` | `identifier`, `value`, `expiresAt` | `@@index([identifier])`. No user column and no foreign key |
| `TwoFactor`, table `two_factor` | `secret`, `backupCodes`, `userId`, `verified` (`true`), `failedVerificationCount` (`0`), `lockedUntil?` | `@@index([secret])`, `@@index([userId])`, cascade. `secret` and `backupCodes` are ciphertext under `BETTER_AUTH_SECRET` |
| `RateLimit`, table `rate_limit` | `key`, `count`, `lastRequest BigInt` | `@@unique([key])`. No user column. The table persists the counters, so a restart cannot clear a lockout |
| `Passkey`, table `passkey` | `name?`, `publicKey`, `userId`, `credentialID`, `counter`, `deviceType`, `backedUp`, `transports?`, `aaguid?` | `@@index([credentialID])`, `@@index([userId])`, cascade |

## Bank connections, accounts and transactions

`budget.prisma` holds eight models. The chain is one line: user, then bank connection, then bank account, then transaction or holding.

| Model and table | Key fields | Constraints and notes |
| --- | --- | --- |
| `BankConnection`, table `bank_connection` | `provider`, `providerSessionId`, `institutionId?`, `institutionName`, `institutionCountry?`, `institutionBic?`, `institutionGroup?`, `status BankConnectionStatus @default(ACTIVE)`, `lastSyncedAt?` | `@@index([userId])` only, cascade. `lastSyncedAt` is also the next sync cursor |
| `BankProviderUser`, table `bank_provider_user` | `provider`, `providerUserId`, `accessToken` | `@@unique([userId, provider])`, cascade. The schema comment states the token is stored as it arrives |
| `BankAccount`, table `bank_account` | `connectionId`, `providerAccountId`, `iban?`, `identificationHash?`, `name?`, `type BankAccountType @default(UNKNOWN)`, `currency?`, `balanceMinor Int?`, `balanceAt?` | `@@unique([connectionId, providerAccountId])`, `@@index([connectionId])`, cascade |
| `Holding`, table `holding` | `providerHoldingId`, `label`, `code?`, `codeType?`, `quantity Decimal @db.Decimal(24, 8)`, `unitCost?` and `unitValue? @db.Decimal(24, 6)`, `valuationMinor Int`, `unrealisedGainMinor Int?`, `currency`, `valuedAt?` | `@@unique([accountId, providerHoldingId])`, `@@index([accountId])`, cascade. A snapshot of the last sync, not a history |
| `Transaction`, table `transaction` | The field groups below | `@@unique([accountId, providerTransactionId])`, `@@index([accountId, date])`, `@@index([accountId, amount])`, `@@index([merchantKey])`, cascade |
| `MerchantOverride`, table `merchant_override` | `merchantKey`, `category`, `merchantName?` | `@@unique([userId, merchantKey])`, `@@index([userId])`, cascade. One user choice for one merchant key |
| `MerchantClassification`, table `merchant_classification` | `signature` (the primary key), `provider`, `model`, `taxonomyVersion`, `category?`, `confidence?`, `answeredBy?`, `classifiedAt` | No user column and no relation. One row per merchant signature, shared by every account on the instance. A null `category` records an abstention |
| `SyncRun`, table `sync_run` | `userId` (the primary key), `phase SyncPhase`, `accountsTotal`, `accountsDone`, `transactionsImported`, `categorisedTotal`, `categorised`, `startedAt`, `updatedAt`, `finishedAt?`, `failures Json?` | Cascade. One row per user, rewritten at each sync. `budget.getSyncStatus` reads it, `budget.syncAccounts` claims it before it starts, and `budget.getSyncOutcome` reads `failures` once it finished |

### The `Transaction` columns

The largest model carries three kinds of column.

| Group | Columns |
| --- | --- |
| Identity and money | `providerTransactionId?`, `date`, `amount Int`, `currency`, `status @default("BOOK")`, `valueDate?`, `transactionDate?`, `balanceAfterTransaction Int?`, `exchangeRate?`, `createdAt` |
| What the bank sent | `description @default("")`, `counterpartyName?`, `merchantCategoryCode?`, `bankTransactionCode?`, `bankTransactionSubCode?`, `bankTransactionFamilyCode?`, `remittanceLines String[]`, `creditorAccountIban?`, `debtorAccountIban?`, `creditorAgentBic?`, `creditorTown?`, `creditorCountry?`, `creditorIdentifications Json?`, `referenceNumber?`, `referenceNumberScheme?`, `psuNote?` |
| What Freenary derived | `normalisedDescriptor?`, `merchantKey?`, `channel?`, `transactionPath?`, `intermediaryName?`, `category?`, `categoryOverride @default(false)`, `resolvedCategory?`, `resolutionStage?`, `resolutionConfidence Float?`, `isInternalTransfer @default(false)` |

The `amount` column is signed minor units, and a negative value is outgoing. The `category` column holds the choice of the reader, and `resolvedCategory` holds the answer of the pipeline.

> [!WARNING] Three gaps in this area cost a contributor time.
>
> **`Transaction` has no `updatedAt` column**, so a re-categorised row records no modification time.
>
> **PostgreSQL treats `NULL` as distinct inside a unique index.** A row with a null `providerTransactionId` therefore inserts again on the next sync.
>
> **No unique constraint covers `(userId, provider, providerSessionId)`** on `BankConnection`. Its one index is `@@index([userId])`, and `exchangeCode` always inserts a new row. Run the connect flow twice for one bank and the user holds two connections.

> [!NOTE] The sync path writes `balanceMinor`, `balanceAt` and every `Holding` row, and no procedure selects them. An instance therefore holds correct balances and holdings with no read path.

## Budget and categories

`budget-profile.prisma` holds two models.

| Model and table | Key fields | Constraints and notes |
| --- | --- | --- |
| `CustomCategory`, table `custom_category` | `label String @db.Citext`, `color`, `icon`, `parentSlug?`, `parentId?`, `sortOrder @default(0)` | `@@unique([userId, label])`, `@@index([userId, parentSlug, sortOrder])`, `@@index([userId, parentId, sortOrder])`, cascade. `color` comes from `CATEGORY_COLOR_VALUES`, `icon` from `CATEGORY_ICON_NAMES`, and `parentSlug` from the three `CATEGORY_GROUPS` |
| `BudgetLine`, table `budget_line` | `label?`, `amount Int` positive minor units, `categorySlug?`, `categoryId?`, `sortOrder @default(0)` | `@@index([userId, sortOrder])`, `@@index([categoryId])`. The `user` relation cascades and the `category` relation uses `onDelete: Restrict` |

`budget.prisma` also holds `SavedFilter`, table `saved_filter`: `name String @db.Citext`, `filters Json`, `search String @default("")`, with `@@unique([userId, name])` and a cascade. `filters` is the `TransactionFilter[]` that `budget.getTransactions` reads, and nothing in the database checks its shape: `listSavedFilters` parses it on the way out.

The budget lines of a user **are** the budget profile. No separate profile row exists. A line names a category and an amount. Its place in the flow comes from the group of that category, through `budgetLineKindOf`. The schema stores no kind column.

> [!WARNING] No database constraint makes `categorySlug` and `categoryId` exclusive, and none makes `parentSlug` and `parentId` exclusive either. The migration adds the column, the self foreign key and the index, and no `CHECK`. PostgreSQL still accepts a row with both, and a row with neither.

### The category parent

`CustomCategory` holds two parent columns, and a row sets one of them at most.

| Column | Points at | The row is |
| --- | --- | --- |
| `parentSlug` | One of the three `CATEGORY_GROUPS` | A top-level category inside a fixed group |
| `parentId` | Another `CustomCategory` of the same user | A subcategory |
| Neither | — | A top-level category, and a group of its own |

`parentId` is the self relation `CustomCategoryNesting`, with `children CustomCategory[]` on the other side and `onDelete: Cascade`. A delete of a parent therefore deletes its subcategories. `deleteCustomCategory` first moves the budget lines of the parent and of every child to the fallback slug.

Three rules hold the tree to one level, and the procedures enforce all three:

- A parent must be a top-level category of the same user. Both parent columns are null on it.
- A category that holds children takes no parent of its own.
- A category is never its own parent.

`sortOrder` counts inside one parent pair. Two rows compare only when they share both `parentSlug` and `parentId`, which is what the two indexes serve.

The wire type is one string. `CategoryEntry.parentKey` in `packages/api/src/lib/categories.ts` carries a `CategoryGroup` slug, a `custom:<id>` key for a custom parent, or `null` for a top-level row. `createCustomCategory` and `updateCustomCategory` read the same shape as `parentKey`, and the server writes `parentSlug` or `parentId` from it.

Exclusivity of the parent pair is structural, and not a constraint. `createCustomCategory` and `updateCustomCategory` read one `parentKey` field, and derive exactly one column from it. No input shape sets both.

The colour a subcategory shows is the stored colour of its parent, through `customCategoryDisplayColor`. Its own `color` stays on the row, and `CategoryEntry.pickedColor` carries it.

## Assistant conversations

`assistant.prisma` holds two models. The transcript lives in PostgreSQL, so a reload replays a conversation from the database.

| Model and table | Key fields | Constraints and notes |
| --- | --- | --- |
| `Conversation`, table `conversation` | `archivedAt?`, `createdAt`, `updatedAt` | `@@index([userId, archivedAt])`, cascade. A null `archivedAt` marks the active conversation, and a new thread stamps the column on the old one rather than delete a row |
| `ConversationMessage`, table `conversation_message` | `role ConversationRole`, `ordinal Int`, `parts Json`, `createdAt` | `@@unique([conversationId, ordinal])`, cascade. No separate index on `conversationId`, because the unique index leads with it |

The `ordinal` column orders a conversation and `createdAt` cannot, because both rows of one turn can share a millisecond. The `parts` column holds the AI SDK message parts as the stream wrote them. So a stored answer replays with its lookup rows intact.

## Instance configuration

`instance.prisma` holds what an operator sets in the setup screen, and the claim that names the operator. Neither model has a user relation, and neither one cascades.

| Model and table | Key fields | Constraints and notes |
| --- | --- | --- |
| `InstanceSetting`, table `instance_setting` | `key` (`@id`), `sealed`, `updatedAt`, `updatedBy?` | One row per environment variable the screen owns. `sealed` is AES-256-GCM ciphertext under a key derived from `BETTER_AUTH_SECRET`, with the row `key` as associated data. `updatedBy` holds a `User.id` and carries no foreign key, so deleting the operator leaves the row |
| `InstanceSetup`, table `instance_setup` | `id` (`@id`, default `singleton`), `claimedAt?`, `completedAt?`, `createdAt` | At most one row, for the whole setup lifecycle. `claimedAt` marks the instance as owned; `completedAt` marks the wizard as finished, which is what stops the web app sending every visitor to `/setup` |

The claim runs in the better-auth `session.create.after` hook, at each new session. It inserts the row with `createMany` and `skipDuplicates`. Then one `updateMany` on `instance_setup`, matched on `claimedAt: null`, runs inside the transaction that sets `User.role`. That conditional update is the lock. A second session matches no row, so two accounts cannot both become the operator.

The migration that creates the table sets `claimedAt` and `completedAt` on an instance that already has users. It gives the role to the oldest user with `emailVerified`, or to the oldest user when none is verified.

## Enums

PostgreSQL holds exactly five enum types. Every value below is verbatim, in declaration order.

### `BankConnectionStatus`

`BankConnection.status` uses it, with the column default `ACTIVE`.

| Value | Meaning |
| --- | --- |
| `ACTIVE` | The connection imports data. Row creation is the one writer of the value |
| `EXPIRED` | The consent ran out |
| `ERROR` | The connection failed |

> [!WARNING] **Only `ACTIVE` is reachable.** The one `bankConnection.create` sets no status, so the default applies, and the one `bankConnection.update` in `packages/api` writes `lastSyncedAt` alone. Nothing under `packages/` or `scripts/` writes `EXPIRED` or `ERROR`, and a sync failure changes no status. A hand-written database update is the only path into either value.
>
> The consequence: a connection whose consent ran out keeps an `ACTIVE` row. It shows an old sync date and imports nothing more. The web app holds a line that renders for a status other than `ACTIVE`, and no code path reaches it. The user disconnects the bank and connects it again, which writes a new row.

### `BankAccountType`

`BankAccount.type` uses it, with the default `UNKNOWN`. `ProviderAccountType` in `packages/api/src/providers/types.ts` mirrors these member names, so sync writes the value with no mapping.

| Value | Meaning | Holds holdings |
| --- | --- | --- |
| `CHECKING` | A current account | no |
| `SAVINGS` | A savings account | no |
| `CARD` | A card account | no |
| `LOAN` | A loan or credit account | no |
| `BROKERAGE` | A securities account | yes |
| `LIFE_INSURANCE` | A life-insurance contract | yes |
| `RETIREMENT` | A retirement plan | yes |
| `EMPLOYEE_SAVINGS` | An employee savings plan | yes |
| `REAL_ESTATE` | A real-estate investment | yes |
| `CROWDLENDING` | A crowdlending position | yes |
| `UNKNOWN` | The bank provider reported no kind, or a kind with no mapping | no |

The last column is `isInvestmentAccountType`, a TypeScript lookup in `packages/api/src/providers/types.ts` and not a database construct. Sync calls `fetchHoldings` for a `yes` row alone.

### `ConversationRole`

`ConversationMessage.role` uses it. It has no default, so every row states its author.

| Value       | Meaning                    |
| ----------- | -------------------------- |
| `USER`      | The question of the reader |
| `ASSISTANT` | The answer                 |

### `UserRole`

`User.role` uses it, with the column default `MEMBER`.

| Value | Meaning |
| --- | --- |
| `MEMBER` | The ordinary account. It reaches its own rows alone |
| `OPERATOR` | The first account that signed in to the instance. It opens the setup screen, and it reads no financial row of another user |

Two code paths set `OPERATOR`: one `user.update` inside the claim transaction, and the backfill `UPDATE` in the migration `20260922120000_instance_configuration`. The SQL in [Troubleshooting](../../apps/fumadocs/content/docs/next/run/troubleshooting.mdx#the-wrong-account-became-the-operator) can also move the role to another account. No endpoint writes the value back to `MEMBER`.

### `SyncPhase`

`SyncRun.phase` uses it, and the column has no default.

| Value | Meaning |
| --- | --- |
| `IMPORTING` | The run is reading accounts and transactions from the providers |
| `CATEGORISING` | The import finished, and the run is resolving categories |
| `FINISHED` | The run ended. `SyncRun.finishedAt` holds the moment |

One row per user, keyed by `userId`. A user therefore has one sync run at a time, and a new run replaces the last one.

### The dropped enum

`BudgetLineKind` was another enum type, with the values `REVENUE`, `INVESTMENT` and `OUTGOING`. The migration `20260904120000_derive_budget_line_kind` dropped the type together with the column `budget_line.kind`. The three names survive as a TypeScript union, and `budgetLineKindOf` derives the value from the group of a category. One group maps to each name: `income` to `REVENUE`, `investments` to `INVESTMENT` and `spending` to `OUTGOING`.

### Free-text vocabularies

Three `String` columns on `Transaction` carry a fixed vocabulary that the schema comments define. PostgreSQL enforces none of the three.

| Column | Values |
| --- | --- |
| `status` | `BOOK` (the default), `PDNG`, `HOLD`, `SCHD`, `RJCT`, `OTHR` |
| `channel` | `card`, `transfer`, `direct-debit`, `atm`, `fee`, `cheque`, `loan`, `unknown` |
| `transactionPath` | `iban` for a transfer or a direct debit, `card` for a card movement |

The category slugs in `Transaction.category`, `Transaction.resolvedCategory`, `MerchantOverride.category`, `BudgetLine.categorySlug` and `CustomCategory.parentSlug` come from `packages/api/src/lib/taxonomy.ts`.

## What the categorisation pipeline writes

Four writers touch the derived columns of a transaction.

| Writer | Columns it writes |
| --- | --- |
| Sync, through `upsertTransaction` | Every raw provider column, plus `channel`, `intermediaryName`, `merchantKey`, `normalisedDescriptor`, `transactionPath`. On create it also sets `category: null` and `categoryOverride: false`. Before the upsert, an `updateMany` scoped by `merchantKeyDiffers` nulls `resolvedCategory`, `resolutionStage` and `resolutionConfidence` on a row whose stored `merchantKey` differs from the new one, with the same skips as `clearResolutions`, so `categoriseUncategorised` resolves the row again. It is one extra indexed round trip per transaction, every sync, whether or not the key changed |
| `matchInternalTransfers` | `isInternalTransfer`, and nothing else. A paired leg keeps the category the pipeline resolved for it |
| `categoriseUncategorised` | `intermediaryName`, `resolvedCategory`, `resolutionStage`, `resolutionConfidence` |
| `updateTransactionCategory` | `category` and `categoryOverride` on the row, the `MerchantOverride` row, and `category` on the siblings that share the merchant key |

`clearResolutions` nulls `resolvedCategory`, `resolutionStage` and `resolutionConfidence`, and it skips a row with `categoryOverride` or `isInternalTransfer`. [Transaction categorisation](./categorisation.md) holds each stage and the value it writes.

## Money and precision

| Concern | Representation |
| --- | --- |
| Transaction amount | `Int`, signed minor units of `currency`. Negative is outgoing |
| Account balance | `balanceMinor Int?` with `balanceAt DateTime?`, minor units of `BankAccount.currency` |
| Balance after a transaction | `balanceAfterTransaction Int?`, minor units |
| Holding valuation | `valuationMinor Int` and `unrealisedGainMinor Int?`, minor units |
| Holding quantity | `Decimal @db.Decimal(24, 8)`, so eight decimal places |
| Holding unit prices | `unitCost` and `unitValue`, `Decimal? @db.Decimal(24, 6)`, so six decimal places |
| Budget line amount | `Int`, minor units, always positive |
| Maximum amount | `2_147_483_647`, the PostgreSQL `INTEGER` ceiling |
| Currency | One ISO 4217 string per row: `Transaction.currency` and `Holding.currency` required, `BankAccount.currency` nullable |

> [!WARNING] **Freenary converts no currency.** No currency table exists, and no column holds a per-user base currency. Two limits follow. The stored `Transaction.exchangeRate` is dead storage, because the adapter maps it and no code reads it. An aggregation adds `Transaction.amount` with no currency filter, so a euro account and a pound account produce one mixed number.

## Ownership and deletion

Twelve models carry a `userId` column, with a foreign key to `user` and `ON DELETE CASCADE`. They are `Session`, `Account`, `TwoFactor`, `Passkey` and `BankConnection`. The rest are `BankProviderUser`, `MerchantOverride`, `CustomCategory`, `BudgetLine`, `Conversation`, `SyncRun`, whose `userId` is its primary key, and `SavedFilter`.

Four models inherit ownership through a relation:

| Model                 | Path to the user                            |
| --------------------- | ------------------------------------------- |
| `BankAccount`         | `BankConnection.userId`                     |
| `Transaction`         | `BankAccount`, then `BankConnection.userId` |
| `Holding`             | `BankAccount`, then `BankConnection.userId` |
| `ConversationMessage` | `Conversation.userId`                       |

`Verification` and `RateLimit` have no owner at all.

Prisma emits no row-level security, so every query states the ownership predicate itself. Two shapes cover the whole codebase:

```ts
// one hop — a bank account, or anything joined to a connection
where: {
  connection: {
    userId;
  }
}

// two hops — a transaction or a holding
where: {
  account: {
    connection: {
      userId;
    }
  }
}
```

Deletion leans on the foreign-key chain. The `disconnect` procedure deletes the `bank_connection` row, and the accounts, transactions and holdings go with it. A `custom_category` row cascades onto its subcategories the same way. The `BudgetLine.category` relation is the one exception. It uses `onDelete: Restrict`. `deleteCustomCategory` first moves each line of the category and of its subcategories to the group fallback slug.

Onboarding needs no model. Two columns on `User` hold the whole state: `taxCountries` and `onboardingCompletedAt`. `onboarding.getStatus` reports `completed` as `onboardingCompletedAt !== null`. The list is the tax jurisdictions the first step asked for, and `bankConnection.listInstitutions` reads it as its country scope.

## Migrations

Thirteen directories sit under `packages/db/prisma/migrations`, with `migration_lock.toml` pinned to `postgresql`. Oldest first:

| Directory | What it does |
| --- | --- |
| `20260828132959_init` | The baseline: the `citext` extension, the types `BudgetLineKind` and `BankConnectionStatus`, and the tables `user`, `session`, `account`, `verification`, `custom_category`, `budget_line`, `bank_connection`, `bank_account`, `transaction`, `merchant_override` |
| `20260830101500_bank_connection_institution_id` | Adds `bank_connection.institutionId` and backfills it from `institutionName` for Enable Banking rows |
| `20260831120000_category_hierarchy` | Moves the flat category set to the two-level hierarchy, maps the legacy slugs across four columns, and renumbers `sortOrder` per parent |
| `20260904090000_auth_second_factors_and_rate_limit` | Adds `user.twoFactorEnabled`, then creates `two_factor`, `rate_limit` and `passkey` |
| `20260904120000_derive_budget_line_kind` | Drops the column `budget_line.kind` and the type `BudgetLineKind`, swaps the index, and makes `budget_line.label` nullable |
| `20260904154129_bank_provider_abstraction` | Creates `BankAccountType`, adds `bank_account.type`, `currency`, `balanceMinor` and `balanceAt`, then creates `bank_provider_user` and `holding` |
| `20260904193133_assistant_conversations` | Creates `ConversationRole`, then `conversation` and `conversation_message` with their index, unique index and cascades |
| `20260918120000_user_tax_countries` | Replaces `user.country` with the list `user.taxCountries`, carrying the single answer already on file into it |
| `20260919120000_merchant_classification` | Creates `merchant_classification`, the instance-wide cache of classifier answers keyed by signature |
| `20260920090000_sync_run` | Creates `SyncPhase`, then `sync_run` with its index and cascade |
| `20260921120000_custom_category_nesting` | Adds `custom_category.parentId`, its self foreign key with `ON DELETE CASCADE`, and the index on `userId`, `parentId` and `sortOrder` |
| `20260922120000_instance_configuration` | Creates `UserRole` and `user.role`, then `instance_setting` and `instance_setup`. On an instance that already has users it marks setup as claimed and completed, and gives `OPERATOR` to the oldest verified user, or the oldest user |
| `20261020120000_saved_filter` | Creates `saved_filter` with its unique index on `userId` and `name`, and its cascade |

### The loop for a schema change

#### 1. Edit the schema

Change the file under `packages/db/prisma/schema/` that owns the area.

#### 2. Generate the migration

```bash
cd packages/db
bun run db:migrate --name <descriptive_snake_case>
```

Always pass `--name`. The baseline name `init` is taken.

#### 3. Read the generated SQL

Open `prisma/migrations/<timestamp>_<name>/migration.sql`. Prisma emits destructive statements, so read the diff before you trust it. Never hand-write, hand-edit or hand-rename a migration.

#### 4. Commit both together

The schema edit and its migration land in one commit. Never edit a migration that already shipped, and fix forward with a new one.

#### 5. Update this file

A new model, column or enum value belongs in the tables above. Other docs quote these names verbatim, so a rename with no documentation edit makes them silently wrong.

`bun run db:push` is development tooling for a scratch database. It writes no history and it would drift a migrated database.

The operator side of a migration is [Update an instance](../../apps/fumadocs/content/docs/next/run/updates-and-backups.mdx).

## Related

- [Transaction categorisation](./categorisation.md) — The pipeline that writes resolvedCategory, resolutionStage and resolutionConfidence.
- [Add a bank provider](./bank-provider.md) — The adapter interface that fills the bank tables.
- [Architecture](./platform.md) — The workspaces, the request path and the generated client.
