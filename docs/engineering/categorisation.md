# Transaction categorisation

The pipeline stages with their confidence values, the taxonomy, the merchant dictionary, and the classifier an operator can configure.

Categorisation turns a bank descriptor into a category slug. The code lives in `packages/api/src/categorisation`, and the offline scripts live in `packages/api/scripts`.

The pipeline is a batch pass over stored rows. It never runs when the web app reads a transaction. Two procedures in `packages/api/src/routers/budget.ts` drive it:

| Caller | When | What it does first |
| --- | --- | --- |
| `budget.syncAccounts` | After a sync imported transactions | Runs `matchInternalTransfers`, then categorises |
| `budget.recategorise` | The reader asks for a fresh pass | Runs `clearResolutions`, then categorises |

`categoriseUncategorised` selects the rows where `resolvedCategory` is null, `categoryOverride` is false and `isInternalTransfer` is false. Every stage writes the same four columns on a hit: `resolvedCategory`, `resolutionStage`, `resolutionConfidence` and `intermediaryName`. A failed row update does not stop the pass. [Data model](./data-model.md#what-the-categorisation-pipeline-writes) owns those column names.

> [!NOTE] One path answers everywhere. `effectiveCategory` in `packages/api/src/lib/transaction-category.ts` prefers `Transaction.category`, the correction of the reader. It falls back to `pipelineCategory`, which decodes `Transaction.resolvedCategory` and ends at `uncategorised`. A read re-runs no stage, so the reader sees what the pipeline stored.

## The stages

The function `categoriseBatch(transactions, options)` loads the dictionary once and walks the batch in order. It then runs the classifier phase over everything no stage resolved. It unloads the dictionary in a `finally` block. Nothing escapes `categoriseTransaction`: any error becomes the unknown result.

`ResolutionStage` holds exactly `channel`, `internal-transfer`, `user-override`, `dictionary`, `mcc`, `rules`, `cached-model`, `model` and `none`. `ResolutionBand` holds `auto`, `suggest` and `unknown`.

| # | Stage | Condition | Confidence | Stage value |
| --- | --- | --- | --- | --- |
| 0 | Merchant key derivation | Always, at sync rather than in the pipeline | — | — |
| 1 | Channel short-circuit | `channel` is `atm`, `cheque` or `fee` | `0.9`, band `auto` | `channel` |
| 2 | User override | A `MerchantOverride` row exists for the pair of user and merchant key | `1`, band `auto` | `user-override` |
| 3 | Shared dictionary | An exact hit on the merchant key, or on the key minus a trailing qualifier word | `0.85`, band `auto` | `dictionary` |
| 4a | Merchant category code | `merchantCategoryCode` resolves | `0.8` | `mcc` |
| 4b | Bank code rules | The bank transaction code hits the `bankCode` table | `0.75` | `rules` |
| 5 | Classifier | A classifier is configured, and it or its fallback answers a category of the taxonomy | The confidence of the provider that answered. Band `auto` at `0.85` and above, else `suggest` | `model`, or `cached-model` when the answer came from the store |
| 6 | Unknown | The fallthrough | `0`, band `unknown` | `none` |

Stages 2 and 3 are skipped when the merchant key is empty. Stages 4 and 5 still run.

### Stage 0 — the merchant key

`deriveMerchantKey` runs inside the sync, and `upsertTransaction` persists `merchantKey`, `normalisedDescriptor`, `channel`, `transactionPath` and `intermediaryName`. Two paths exist.

The **IBAN path** takes a creditor IBAN when the family code is `ICDT`, `PMNT`, `RCDT` or `RDDT`. It also takes one when no family code exists and the raw descriptor does not look like a card movement. The key is the trimmed upper-case IBAN.

The **card path** normalises the parsed payee text. With a payment service provider in the middle, it takes the sub-merchant text instead. It then strips trailing place tokens. Any throw returns an empty key with `channel: "unknown"` and the card path.

Normalisation folds the `oe` and `ae` ligatures, strips combining marks and apostrophes, then lowercases. It splits on non-alphanumerics, then drops digit-bearing tokens and 91 noise tokens. The same function normalises a bank descriptor and a dictionary name, which is what makes the two comparable.

### Stage 1 — channel short-circuit

One constant table of three entries.

| Channel  | Category          |
| -------- | ----------------- |
| `atm`    | `cash-withdrawal` |
| `cheque` | `uncategorised`   |
| `fee`    | `loans-bank-fees` |

The channel value seeds from the ISO 20022 family code. A verb prefix overwrites it only when it is still `unknown`.

### Stage 2 — user override

`lookupUserOverride` runs a `findUnique` on the unique index of `MerchantOverride`. A database error returns `null` rather than an exception. A hit carries the stored merchant name.

### Stage 3 — shared dictionary

An exact-match table. The relaxation sits in the key, not in the lookup. The helper `merchantKeyCandidates` yields the key, then the key minus one trailing qualifier token at a time. It stops at the first non-qualifier tail, or when the candidate falls below the minimum length.

The default qualifier layer is `internet`, `mobile` and `telecom`. The French layer adds `abonnement`, `electricite`, `energie`, `energies`, `fibre`, `forfait`, `france` and `gaz`.

### Stage 4 — the deterministic layer

**4a, the merchant category code.** One range answers first: the whole issuer-assigned block from `FIRST_ISSUER_ASSIGNED_TRAVEL_MCC` to `LAST_ISSUER_ASSIGNED_TRAVEL_MCC`, which is `3000-3999`, gives `transport-travel`. Airlines, car rental and lodging share one category now, so the three old sub-ranges collapsed into it. A flat table of 221 keys answers after it, over 13 distinct categories. The stage runs no direction check. A code on a credit therefore lands in the category of the merchant, as a refund.

**4b, the bank code rules.** One lookup: the bank transaction code of the provider, lower-cased, against the `bankCode` table. Every candidate passes `acceptInDirection`, which rejects a non-income category on a positive amount. The tables concatenate the country layer before the default layer once, at module load. Only `FR` is registered: `default.ts` holds 6 rows and `fr.ts` holds 5. Each pattern is wrapped in lookarounds by `wholeTokenPattern`, so it matches whole tokens only.

1. The bank code against the `bankCode` table.
2. The counterparty name against the `counterparty` table.
3. The normalised descriptor against the `counterparty` table.
4. The normalised descriptor against the `bankCode` table.

Every candidate passes `acceptInDirection()`. It rejects a category whose direction is `out` on a positive amount, and it accepts everything else. A category with direction `in` or `both` therefore passes on either sign, and the guard fires on a credit alone. The tables concatenate the country layer before the default layer once, at module load. Only `FR` is registered: `default.ts` holds 9 rows and `fr.ts` holds 5. Each pattern is wrapped in lookarounds by `tokens()`, so it matches whole tokens only.

### Stage 5 — the classifier

This stage runs for the whole batch at once, and only when `TRANSACTION_CLASSIFIER` names a protocol. Every transaction still at stage `none` becomes a `ClassificationInput`, grouped by merchant identity. For each classifier of the chain, the `MerchantClassification` cache answers first, then the endpoint. The taxonomy validates every answer. [The classifier](#the-classifier) holds the payload, the cache, the cascade and the three protocols.

### Stage 6 — unknown

`UNKNOWN_RESULT` is `{ band: "unknown", category: null, confidence: 0, intermediaryName: null, merchantName: null, stage: "none" }`.

### Two passes beside the pipeline

| Pass | File | What it writes |
| --- | --- | --- |
| Internal transfers | `internal-transfer.ts` | Pairs an outgoing and an incoming transaction of equal absolute amount and the same currency, on two accounts of one user, inside 24 hours. It then sets `isInternalTransfer: true` and nothing else. A movement between the user's own accounts is a transaction type, and no category names it |
| Recurrence | `recurrence.ts` | Nothing. It groups outgoing transactions by merchant key. It then reads a cadence, a recurrence type, a confidence level and a month-by-month split. The file holds no write, and each request recomputes the answer. [Recurrence detection](#recurrence-detection) holds the rules |

The internal-transfer pass includes rows that already carry a category, and it returns `0` on any throw.

> [!NOTE] **Dead code, stated as a fact about the current tree.** `internal-transfer.ts` selects `BankAccount.identificationHash` and never uses it. The pairing reads amount, currency and date alone. The schema comment calls that column a cross-account matching key, and no code matches on it.

## Deterministic versus asked

| Part | Deterministic |
| --- | --- |
| Merchant key derivation, normalisation, channel detection, intermediary detection | yes, pure functions over the transaction and static tables |
| Stage 1, the channel short-circuit | yes, a three-entry constant |
| Stage 2, the user override | yes, one `findUnique` on a unique index |
| Stage 3, the dictionary | yes, an exact `Map.get` on a pre-built artifact |
| Stage 4, the code and the bank-code table | yes, range checks and regular expressions |
| The internal-transfer pass | yes, amount, currency and date arithmetic |
| Stage 5, the classifier | no. A configured model answers, and it runs only when one is configured |

> [!WARNING] **Nothing leaves the instance until an operator names a classifier.** With `TRANSACTION_CLASSIFIER` unset, stages 1 to 4 run and what they leave undecided stays uncategorised. No socket opens.
>
> With a classifier configured, one request per merchant identity carries exactly these ten fields, the `ClassificationInput` allow-list:
>
> `normalisedDescriptor`, `merchantKey`, `counterpartyName`, `merchantCategoryCode`, `direction`, `amountBucket`, `currency`, `country`, `channel` and `path`.
>
> `direction` is the sign alone and `amountBucket` is one of `micro`, `small`, `medium` and `large`. On the IBAN path the merchant key is the creditor account number, so it is dropped. A transfer or a direct debit is described by its descriptor and its counterparty. The exact amount, the date, the IBAN, the raw descriptor, the account and the user never reach a provider. The answer is cached by merchant signature. One merchant is asked about once, and every later transaction of that merchant reads the database.
>
> The assistant is a separate surface: nothing under `categorisation/` imports from `assistant/`, and nothing under `assistant/` imports from `categorisation/`.

Stages 1 to 4 are deterministic: the same transaction data always gives the same category, with no model involved. The classifier sees only what those stages leave undecided.

## Recurrence detection

`recurrence.ts` reads a cadence out of the stored transactions. It is a pure read: it holds no write, and it never throws. `detectRecurring` returns empty aggregates on a database error. [Budget](../../apps/fumadocs/content/docs/next/use/budget.mdx) is the reader view of the result. The procedure that serves that view is [`budget.getRecurring`](../../apps/fumadocs/content/docs/next/reference/procedures.mdx#budgetgetrecurring).

### What a group is

`recurringInWindow(transactions, window)` groups the transactions by `merchantKey`. The read behind it takes outgoing rows alone, and it drops an internal transfer. The window is enforced in the grouping, not in the query. A row with no merchant key joins no group, and a group of fewer than two transactions is dropped.

The detector sorts each group by date. It then measures the interval in days between consecutive transactions. The median of those intervals is the cadence, and `nextExpected` is the last date plus that median.

### The frequency bands

The median interval lands in one band. Each band sets its own minimum of occurrences.

| Frequency   | Median interval                          | Minimum occurrences |
| ----------- | ---------------------------------------- | ------------------- |
| `weekly`    | 5 to 9 days                              | 4                   |
| `monthly`   | 25 to 35 days                            | 3                   |
| `quarterly` | 80 to 100 days                           | 2                   |
| `annual`    | 340 to 395 days                          | 2                   |
| `irregular` | 10 to 400 days, outside every band above | 4                   |

A median interval outside every named band falls back to `irregular`. A group that misses the minimum of its band gives no result at all.

### Dispersion

Both spreads are a relative median absolute deviation: `median(|v − median(v)|) / median(v)`. The value is `0` when the median is `0`. A ratio, rather than cents or days, makes an amount and an interval comparable against one threshold.

| Signal           | Measured over                                  |
| ---------------- | ---------------------------------------------- |
| `amountSpread`   | The absolute amounts of the group              |
| `intervalSpread` | The intervals between consecutive transactions |

The file exports three thresholds.

| Name | Value | Meaning |
| --- | --- | --- |
| `STABLE_AMOUNT_SPREAD` | `0.05` | At or below it, the charge repeats at the same price |
| `VARIABLE_AMOUNT_SPREAD` | `0.25` | Above it, the reader sets the price rather than a contract |
| `REGULAR_INTERVAL_SPREAD` | `0.2` | At or below it, the cadence holds a schedule |

### The classification

`classifyRecurrence({ amountSpread, frequency, intervalSpread, occurrences })` is pure and exported. It reads those four signals and no transaction list. It returns one `kind` and one `confidence`.

`kind` is `fixed` when all three conditions hold:

1. The frequency is not `irregular`.
2. `intervalSpread` is at most `REGULAR_INTERVAL_SPREAD`.
3. `amountSpread` is at most `VARIABLE_AMOUNT_SPREAD`.

Every other group is `behavioral`. The confidence follows from the kind:

| `kind` | Condition | `confidence` |
| --- | --- | --- |
| `fixed` | `amountSpread` at most `STABLE_AMOUNT_SPREAD`, and 3 occurrences or more | `confirmed` |
| `fixed` | Any other fixed group | `likely` |
| `behavioral` | Always | `pattern` |

> [!NOTE] **Neither an exact date nor an exact amount is needed.** A bank moves its processing date, and a utility bill moves its amount. A group still reads as `fixed` while both spreads stay inside their thresholds. `REGULAR_INTERVAL_SPREAD` sets how far the date can move, and `VARIABLE_AMOUNT_SPREAD` sets how far the amount can move.

### One read, two aggregates

`detectRecurring(userId, window)` does one transaction read and returns both aggregates. The field `expenses` holds the detected patterns, biggest typical amount first. The field `months` holds the month-by-month split.

`recurringMonthsInWindow(transactions, window, expenses)` attributes each in-window outgoing transaction to one of three totals. The key is `YYYY-MM`, with a 1-based calendar month.

| Total | What it collects |
| --- | --- |
| `fixedMinor` | A merchant key the detector classified as `fixed` |
| `behavioralMinor` | A merchant key the detector classified as `behavioral` |
| `discretionaryMinor` | Everything else |

The third total is the fallback. A transaction with no `merchantKey`, or one that no detected pattern claims, is discretionary. The split takes the detected expenses rather than a second detection pass, so the two aggregates always agree. It returns the months it saw, and a caller that wants a fixed span fills the gaps itself.

### The two windows

| Helper | Window | What it means |
| --- | --- | --- |
| `cadenceWindow(from, to)` | The period widened by one year on each side | A cadence belongs to the merchant, not to where the reader stands, so the same rent never reads fixed in one month and variable in the month before it |
| `trailingYear(to)` | The year that ends at `to` | The window a forward-looking commitment list means |

`detectRecurringExpenses(userId, window)` keeps its old signature and its old behaviour. It is a projection of `detectRecurring` on the `expenses` field.

## The taxonomy

`packages/api/src/lib/taxonomy.ts` declares the taxonomy once, in code. The database declares no part of the predefined set.

| Thing | Symbol | Count |
| --- | --- | --- |
| Category groups, in flow order | `CATEGORY_GROUPS` | 3 |
| Category slugs, income included | `SPENDING_CATEGORIES` | 27 |
| Category to group | `CATEGORY_GROUP_OF` | exhaustive |
| Category to direction | `CATEGORY_DIRECTION_OF` | exhaustive |
| Category colours | `CATEGORY_COLOR_VALUES` | 7 |
| Category icons | `CATEGORY_ICON_NAMES` | 28 |
| Group fallbacks | `CATEGORY_GROUP_FALLBACKS` | one catch-all category per group |
| Legacy slugs | `LEGACY_CATEGORY_SLUGS` | 70 old and pre-hierarchy spellings |
| Legacy groups | `LEGACY_CATEGORY_GROUPS` | 14 old group names, all onto `spending` |

The 3 groups are `income`, `investments` and `spending`. They are sections of the flow of money, and not topics. `income` is what arrives. The other two are the two ways it leaves. `income` holds 7 categories, `investments` holds 4, and `spending` holds 16.

**The set is flat.** A group holds categories and a category holds nothing. An icon belongs to the category, and `categoryIcon` reads `CATEGORY_ICONS`. A colour belongs to the group. `categoryColor` reads `CATEGORY_GROUP_COLORS` through `CATEGORY_GROUP_OF`, so two categories of one group share a colour and differ by glyph. A chart has no glyph, so `categoryChartColor` shades that colour by the place of the category in its group.

**Each category names one direction.** `CATEGORY_DIRECTION_OF` holds `in`, `out` or `both`, and `categoriesForDirection` reads it. That gives 10 categories on an incoming transaction, and 20 on an outgoing one. `people`, `cash-withdrawal` and `uncategorised` are the three that carry `both`. The pickers of the web app offer that list, and no procedure checks a direction against an amount.

**A signal maps to the most precise category it supports, and no further.** A merchant category code for a supermarket gives `groceries`. A signal that proves the group alone gives that group's catch-all. Those are `other-income` for `income`, `savings` for `investments` and `uncategorised` for `spending`. The fallback ladder is those three entries, and nothing else. The pipeline invents no precision the signal does not carry.

`LEGACY_CATEGORY_SLUGS` decodes the two-level spelling and the flat one before it. A stored row and an old artifact therefore still resolve. `LEGACY_CATEGORY_GROUPS` does the same for a group name, and every topic group lands on `spending`.

A reader cannot add or rename a predefined category. The array `SPENDING_CATEGORIES` is `as const`, and both the update procedure and the transaction filter accept its enum alone. Custom categories exist for budget lines, under the key space `custom:<id>`. [Categories](../../apps/fumadocs/content/docs/next/use/budget.mdx) is the reader view.

## User corrections

A correction of the reader is permanent, and it asks for no reconciliation.

`budget.updateTransactionCategory` runs one database transaction:

1. It validates the input against `z.enum(SPENDING_CATEGORIES).nullable()`. A `null` clears the choice.
2. It sets `Transaction.category`, and `categoryOverride` to the truth of a non-null category.
3. With a merchant key on the row, it upserts a `MerchantOverride` row, or deletes it for a `null` category.
4. It propagates the value to the sibling transactions with the same merchant key and no override of their own.

`upsertUserOverride` and `deleteUserOverride` swallow every error, so a failure there cannot break a sync. The override becomes stage 2 and outranks stages 3 to 7.

> [!WARNING] Stage 1 runs **before** the override. A transaction whose channel is `atm`, `cheque` or `fee` short-circuits at stage 1. The pipeline never reads the override for it. The read-time value still honours `Transaction.category`.
>
> One more asymmetry: stage 3 relaxes the merchant key with the qualifier list and the stage 2 lookup does not. An override recorded on `free mobile` does not fire for `free mobile internet`, and the dictionary does.

## The merchant dictionary

The artifact is `packages/api/data/merchants.jsonl.gz`, gzipped JSONL, one merchant per line.

| Field | What it holds |
| --- | --- |
| `id` | The merchant id. The build sorts the rows by it |
| `name` | The display name |
| `normalisedName` | The match key |
| `category` | A category slug, or `null`. The loader drops a null row |
| `domains` | The domains the build collected for the merchant |
| `source` | The provenance of the row, such as the Name Suggestion Index |
| `aliases` | Each alias with its normalised form |
| `countries` | The country scope. It is optional, because an artifact built before the scope existed carries none |

`dictionary.ts` streams the file into a module map with a reference count. The keys are `normalisedName` plus every `normalisedAlias` that no other row took. It drops a row with a null category. It also drops a row outside the country scope of the batch, where an empty `countries` list means worldwide. A missing file warns once and leaves an empty map, so stage 3 becomes a permanent miss.

### The build

`build-merchant-dictionary.ts` fetches a pinned Name Suggestion Index tarball, version `8.0.20260729`, and runs these passes:

| Pass | What it does |
| --- | --- |
| 1 | Collects the raw candidates, and maps an index path to an OpenStreetMap tag and then to a category |
| 2 | Drops place-only names. **A permanent no-op**: `isEntirelyPlaceName` returns `false` for every input, so the pass drops nothing and still logs a count of zero |
| 3 | Resolves `normalisedName` collisions by category priority, elects one primary name, and unions the aliases, the domains and the country scopes |
| 3b | Merges the Wikidata aliases and domains, with no category. A missing input file warns and skips |
| 4 | Merges the curated supplement of 54 hand-written entries, which wins every collision |

Place-token stripping still happens at runtime, on the tail of the merchant key. Pass 2 is the build-time filter, and it is inert.

Rows sort by `id` for byte-stable diffs, then compress at gzip level 9. **One artifact covers every country**, and each consumer filters `countries` in memory. A transient failure with an artifact already on disk warns and exits `0`. So a stale dictionary can survive a green build.

| Source | Endpoint or version |
| --- | --- |
| Name Suggestion Index | `name-suggestion-index@8.0.20260729` from the npm registry |
| Wikidata | `data/wikidata-brands.json`, built by `fetch-wikidata-brands.ts` |
| Curated supplement | `packages/api/scripts/lib/curated-merchants.ts` |

### The scripts

Run each one from `packages/api`.

| Script | Literal command | Writes |
| --- | --- | --- |
| `build:data` | `bun scripts/download-data.ts \|\| bun run build:data:generate` | The released artifacts, or the rebuilt ones |
| `build:data:generate` | `generate-place-tokens.ts && fetch-wikidata-brands.ts && build-merchant-dictionary.ts` | The same artifacts, from the upstream sources |
| `build:places` | `generate-place-tokens.ts` | `data/place-tokens.json` |
| `generate:key` | `generate-signing-key.ts` | `data/dictionary.key`, mode `0600`, and the public key on standard output |

The root passthrough is `bun run build:data`, which Turborepo marks uncached. It resolves the repository from `GITHUB_REPOSITORY`, then from the `origin` remote, then from the literal `suiramdev/freenary`.

## The dictionary signature

The artifact can carry an Ed25519 signature. `build-merchant-dictionary.ts` signs it when `data/dictionary.key` exists and writes `merchants.jsonl.gz.sig`. With no key it logs that the dictionary is unsigned, and a signing failure only warns.

At runtime `verify.ts` reads `env.DICTIONARY_PUBLIC_KEY`. The schema in `packages/env` declares it as an optional string with no format check, so a malformed key passes startup and only fails at load. A blank or absent value means unconfigured, and the loader skips the check. With a key set, a failure never throws:

| Condition | Log line | Effect |
| --- | --- | --- |
| The `.sig` file is absent | `[categorisation] Dictionary signature missing: … — refusing to load` | The map stays empty |
| The signature does not check out | `[categorisation] Dictionary signature invalid: … — refusing to load` | The map stays empty |

A failure disables stage 3 and nothing else. Stages 1, 2, 4, 5 and 6 still run.

> [!WARNING] **The published artifact carries no signature, so a configured public key turns the dictionary off.** The weekly release tarball packs the dictionary and the place tokens. It sometimes packs the Wikidata brands, and never a `.sig` file. An instance that fetches its dictionary through `build:data` and sets a public key hits the missing-signature path. It loses stage 3 in silence.
>
> `generate-signing-key.ts` prints a banner that names `verify.ts` as the place for the key. That file embeds no key and reads the environment variable alone. [Configuration](../../apps/fumadocs/content/docs/next/reference/configuration.mdx#categorisation) holds the operator warning for this trap.

## The classifier

A merchant that no rule, no dictionary entry and no correction knows reaches the classifier phase. Only there does anything leave the instance. The phase runs once per batch, after every deterministic stage.

`TransactionClassifier` in `packages/api/src/categorisation/classifier/types.ts` is the whole contract. It holds a `provider` name, which is the protocol, a `model` id, and `classify(input)`. That function answers a category with a confidence, or `null` to abstain.

`registry.ts` reads two slots, `TRANSACTION_CLASSIFIER` and `TRANSACTION_CLASSIFIER_FALLBACK`, and builds an ordered chain of one or two classifiers. Unset, it builds an empty chain and the phase never runs. A fallback with no first slot stops the start. A fallback that repeats both the protocol and the model of the first slot stops it too. The two would share one cache row.

| Step | What happens |
| --- | --- |
| Payload | `classificationInputFrom` builds the `ClassificationInput` allow-list. A transaction with neither a merchant key nor a normalised descriptor is dropped |
| Grouping | `payloadSignature` hashes the merchant identity: the merchant key or the descriptor, the country, the direction and the merchant category code. Every pending transaction with the same hash becomes one group, so one merchant costs one question whatever the amounts |
| Signature | `classificationSignature` hashes the same identity behind the protocol, the model and `TAXONOMY_VERSION`. Each classifier of the chain therefore owns its own cache row |
| Cache | `MerchantClassification` answers first. A stored category applies at stage `cached-model`. A stored abstention is honoured for 30 days, then asked again |
| Call | Bounded to 4 merchants in flight. A provider aborts its own request after 10 seconds, inside the resolver's 15-second budget |
| Validation | The answer must be a slug of the taxonomy, with a confidence inside `0..1`, and the direction of the transaction must permit it. Anything else is refused, logged and cached nowhere |
| Store | An accepted category and an explicit abstention are written. A failure is not: a provider rejects on an unreachable endpoint, a refused request and an undecodable answer, which keeps a transient fault out of the 30-day abstention |

A store failure never fails the batch. A classifier failure never fails a transaction: the deterministic result stands, and the row stays uncategorised.

### The cascade

The resolver asks the first classifier. It escalates to the second one when the first abstains, or when the answer is under `TRANSACTION_CLASSIFIER_ESCALATE_BELOW`. That variable is `0.85` by default. The pipeline needs that confidence to write a category without asking the reader. An answer that could only suggest therefore earns a second opinion.

The higher-confidence answer of the two wins, and a weaker second opinion never replaces a stronger first one. The chain stops at the first answer at or above the bar, so a confident first classifier costs one call. At `0`, the second classifier answers abstentions alone.

Each classifier holds its own cache row, so the second batch reads both answers from the store and calls nothing. A chain of a local model and a hosted one therefore pays the hosted price once per merchant.

### One statistic, three protocols

`confidence.ts` holds `concentration`, which is `1 - H(p) / ln(n)` over the offered options. Every provider reports that one statistic, so a credit answer and a debit answer compare at one threshold. A raw probability for the picked option falls as options are added. A threshold on it is therefore a threshold on the size of the taxonomy. A concentration does not move that way.

`ACCEPT_CONFIDENCE` is `0.5` and belongs to every provider. An answer under it is an abstention, and so is `uncategorised`. Each slot also takes a temperature that sharpens or flattens the distribution before the measure, because these models ship over-confident. Fit it on merchants your own readers corrected.

A slot names a protocol, never a vendor. Each one carries its own URL, so it reaches a server you run or a server somebody else hosts. A URL on your own hardware keeps the descriptors there, which is the recommendation rather than a rule.

| Protocol | What the slot URL receives | Where the number comes from |
| --- | --- | --- |
| `system-one` | The TypeSafe `/v1/systemone` request, posted to the URL as it is | The concentration of `probabilities` when a temperature is fitted, else the reported `certainty`, else the reported `confidence` |
| `llm` | A chat completion, posted to the URL plus `/chat/completions` | The concentration of the log probabilities of the answer letter |
| `zero-shot` | The Hugging Face zero-shot-classification request, posted to the URL as it is | The concentration of the label scores |

Both slots read the same four settings: a URL, a model, a key and a temperature. The fallback reads them under the `TRANSACTION_CLASSIFIER_FALLBACK_` prefix. A chain can therefore hold two endpoints of one protocol. A local `system-one` server can escalate to a hosted one.

### The system-one provider

`providers/system-one.ts` posts one request: a `state`, one `choice` question and a `model` name. TypeSafe answers it at `https://api.typesafe.ai/v1/systemone`. `Mapika/decider-2b` serves the same route through `decider.serve`, and Laya answers the same shape. The provider sends an authorisation header only when the slot holds a key. A server on your own network wants none.

The two question sets, one for each direction, are built at module load from `categoriesForDirection`. A credit is offered the ten categories a credit can take, and a debit the twenty a debit can take. The model never sees an option that the picker refuses.

Each option carries a sentence that describes the situation it covers, held in `CATEGORY_CRITERIA` in `questions.ts` beside the question. Every provider shares that text. A label alone is not a rubric: `Other` and `People` say nothing on their own.

A category that the direction does not permit is a contract failure: the provider logs it and refuses it.

### The llm provider

`providers/llm.ts` posts one chat completion to an OpenAI-compatible endpoint. A local runtime and a gateway both answer it. The options are lettered, `(A)` to `(T)`, because a slug spans several tokens and one letter does not. The request carries `temperature: 0`, so the decision repeats, and it asks for `logprobs` with `top_logprobs` equal to the option count. The provider maps the returned letters back to categories, then measures their distribution.

An endpoint that returns no log probabilities still answers. The provider reads the letter the model wrote and reports `UNDISTRIBUTED_CONFIDENCE`, which is the acceptance bar itself. Such an answer can only ever suggest a category, and never write one.

### The zero-shot provider

`providers/zero-shot.ts` posts the Hugging Face zero-shot-classification shape: one line of state, the candidate labels and a hypothesis template. A cross-encoder such as `MoritzLaurer/ModernBERT-large-zeroshot-v2.0` answers there.

The candidate labels are the rubrics rather than the slugs. The model scores an entailment, and a slug entails nothing. The provider holds the reverse map from rubric to category, and it decodes both documented response shapes. It weighs the returned scores against every offered option, so a short answer stays comparable with a complete one.

### The model in the cache key

A slot model is part of the signature, so a change to it asks every merchant again. A moving alias such as `jev-latest` is safe: the cache key holds the configured string. The stored answers therefore survive the alias moving. The `answeredBy` column records the versioned id that answered. Name a version in the slot model to freeze both.

## The weekly workflow

`.github/workflows/generate-data.yml` rebuilds the data and publishes a release.

| Field | Value |
| --- | --- |
| Schedule | `cron: "0 3 * * 1"`, so Monday at 03:00 UTC |
| Other triggers | `workflow_dispatch`, and a push to `dev` or `main` that touches `packages/api/scripts/**` or `normalise/**` |
| Job timeout | 60 minutes |
| Permissions | `contents: write` |

The steps run in this order:

1. Install with `--ignore-scripts`.
2. Run `generate-place-tokens.ts` and `fetch-wikidata-brands.ts` in parallel.
3. Build the dictionary.
4. Pack the artifacts, then publish the release `data-<YYYY-MM-DD>` with the asset `merchant-data.tar.gz`.

The publish step deletes any same-day release and tag first, and it passes `--latest=false`.

## Change a rule or a category

### Add a keyword rule

#### Pick the layer

A country-specific pattern goes in `keywords/fr.ts`. A worldwide one goes in `keywords/default.ts`.

#### Check the signal

The table reads the bank transaction code of the provider and nothing else. A rule keyed on a merchant name belongs in the dictionary or in the curated supplement. Those match a name as a whole merchant, not as a substring of a descriptor.

#### Map to the right precision

Map to the most precise category the signal supports. Where the signal proves the group alone, use that group's catch-all: `other-income`, `savings` or `uncategorised`. A signal that cannot even place the group belongs in no table.

#### Test and re-categorise

Run the test file next to the one you changed with `bun test <path>`, then call `budget.recategorise` to see the effect.

### Add a category slug

#### Extend the taxonomy

Add the slug to its group's array in `CATEGORIES_BY_GROUP`, which is what builds `SPENDING_CATEGORIES`. Then add it to `CATEGORY_GROUP_OF`, `CATEGORY_LABELS`, `CATEGORY_DIRECTION_OF` and `CATEGORY_ICONS`. Each of those four is a `satisfies Record<SpendingCategory, …>`. A missed one is a TypeScript error, not a blank in the interface. The colour needs no entry, because the group supplies it.

#### Add both messages

Add the key `category_<slug_with_underscores>` to `apps/web/messages/en.json` and to `apps/web/messages/fr.json`, in the same commit.

#### Add the renderer entry

Add the entry to `CATEGORY_MESSAGES` in `apps/web/src/entities/category/model/taxonomy-labels.ts`.

#### Retire a slug through the decoder

A new slug needs no more than the tables above. A retired slug needs an entry in `LEGACY_CATEGORY_SLUGS`, and a retired group needs one in `LEGACY_CATEGORY_GROUPS`. `resolveCategorySlug` and `resolveCategoryGroup` then decode a stored row and a prebuilt merchant dictionary that still spells the old name. Five columns hold a slug: `transaction.category`, `transaction.resolvedCategory`, `merchant_override.category`, `budget_line.categorySlug` and `custom_category.parentSlug`. No data migration rewrites them, because every read passes through the decoder.

> [!WARNING] **Two failure modes when the taxonomy and the catalogs disagree.**
>
> `CATEGORY_MESSAGES` ends with `satisfies Record<SpendingCategory, () => string>`, so a slug with no entry is a TypeScript error. `apps/web` declares no `check-types` script, so `bun run check-types` misses that file.
>
> A key in `en.json` with no twin in `fr.json` is worse. It compiles with no error and no warning. The French branch falls back to the English string, and no build step catches it.

## Module notes

What the overview above omits, per module. The dictionary build and its sources are in `packages/api/data/README.md` and [data-pipeline.md](./data-pipeline.md).

Durable facts that the code cannot carry in a name. Each bullet names the module it belongs to. Source: comments deleted when the `no-comments` rule was adopted.

### Normalisation

- `packages/api/src/categorisation/normalise/normalise-descriptor.ts › normaliseDescriptor` — the single spelling authority. The runtime (`packages/api/src/lib/bank-sync.ts` on write), the dictionary build and `packages/api/scripts/generate-place-tokens.ts` all call it. Stage 3 is an exact `Map.get`, so any divergence between the two sides turns every lookup into a silent miss; that is why the module imports nothing and holds no institution-specific behaviour.
- `packages/api/src/categorisation/normalise/normalise-descriptor.ts › normaliseDescriptor` — the result is persisted (`Transaction.normalisedDescriptor`) rather than derived in a query. Postgres cannot reproduce it in an expression index: `unaccent()` is STABLE, not IMMUTABLE. `packages/api/src/routers/budget.ts` groups on the stored column in raw SQL.
- `packages/api/src/categorisation/normalise/normalise-descriptor.ts › IDENTITY_FREE_TOKENS` — channel verbs, card markers, settlement-timing markers and legal forms are dropped so that a bank descriptor converges on the dictionary's `normalisedName`, which the build produced with the same function.
- `packages/api/src/categorisation/normalise/normalise-descriptor.ts › REMOVED_APOSTROPHES` — apostrophes are deleted, not treated as separators: banks print `MCDONALDS`, so splitting `McDonald's` into `mcdonald s` would never match.
- `packages/api/src/categorisation/types.ts › OutgoingNegativeMinorUnits` — the alias erases to `number`, so nothing type-checks the sign convention it documents. Two places depend on it: `normalise/institutions/parse-engine.ts › partyNames` picks which party is the counterparty, and `deterministic.ts › readsAsRefund` decides direction.
- `packages/api/src/categorisation/merchant-key.ts › IBAN_FAMILY_CODES` — the ISO 20022 family codes that route to the IBAN path: `RCDT` received credit transfer, `RDDT` received direct debit, `ICDT` issued credit transfer, `PMNT` generic payment. `PMNT` is the generic family, which is why it carries no channel in `normalise/institutions/iso20022-channel.ts`.
- `packages/api/src/categorisation/merchant-key.ts › looksLikeCardDescriptor` — `CARD_PREFIX_LENGTH` is 15 because that is the measured width of the intermediary prefixes French banks print (`PAYPAL *MERCHANT NAME`). An asterisk further into the string is merchant text, not a marker.
- `packages/api/src/categorisation/merchant-key.ts › withoutTrailingPlaces` — French card descriptors suffix the town (`CARREFOUR MARKET PARIS`), so town-suffixed descriptors only converge on one key once the trailing place tokens are gone. The token list comes from `packages/api/scripts/generate-place-tokens.ts`, whose `EUROPEAN_COUNTRIES` scope is deliberately wider than `SUPPORTED_COUNTRIES` so cross-border descriptors normalise too.
- `packages/api/src/categorisation/place-tokens.ts › isPlaceToken` — returns false for every token until `bun run build:data` writes `data/place-tokens.json`; the directory ships only a `README.md`. On a fresh checkout `merchant-key.test.ts › "drops deferred and immediate debit markers"` therefore fails on its second assertion with `monoprix paris` instead of `monoprix`. That failure is the missing artifact, not the code.
- `packages/api/src/categorisation/merchant-key.test.ts › "drops deferred and immediate debit markers"` — deferred-debit cards print `DEBIT DIFFERE` between the card marker and the merchant name. The merchant key is an exact dictionary lookup, so one kept marker misses every merchant behind it.

### Institution parsers

- `packages/api/src/categorisation/normalise/institutions/iso20022-channel.ts › CHANNEL_BY_FAMILY_CODE` — the keys are ISO 20022 External Code Sets `ExternalBankTransactionFamily` values, delivered by Enable Banking as `bank_transaction_code.code`. They are standardised across SEPA banks, so the family code seeds the channel and a descriptor verb prefix only fills it in when it is still `unknown`.
- `packages/api/src/categorisation/normalise/institutions/parse-engine.ts › parseWithInstitution` — remittance-line order is not guaranteed by providers, and a pattern match overwrites an already-found payee, so line order changes the answer. The lines are sorted before parsing to make the outcome deterministic.
- `packages/api/src/categorisation/normalise/institutions/parse-engine.ts › parseWithInstitution` — the returned `normalisedDescriptor` is the normalised **payee**, not the whole remittance text. Lines the parser dropped never reach the keyword tables or the classifier, both of which read that field.
- `packages/api/src/categorisation/normalise/institutions/parse-engine.ts › applyCounterparty` — for SEPA direct debits the counterparty name _is_ the merchant, so it overrides a parsed payee. The remittance text of a direct debit carries the billing reason (`Loyer`, `Internet fibre`), not the payee.
- `packages/api/src/categorisation/normalise/types.ts › DescriptorParseResult.labelDate` — a date embedded in the descriptor itself, never the bank's booking date, and ISO `yyyy-mm-dd` only when unambiguous. The Crédit Mutuel card rules in `institutions/countries/fr.ts` capture a four-digit `DDMM` with no year and deliberately declare no `parseLabelDate`, so they yield no label date at all.
- `packages/api/src/categorisation/normalise/institutions/countries/fr.ts` — the French descriptor vocabulary the patterns match: `PRLV`/`PRELEVEMENT` direct debit, `VIR`/`VIREMENT` credit transfer, `RETRAIT DAB` ATM withdrawal, `ACHAT CB`/`FACTURE CARTE`/`PAIEMENT PAR CARTE` card payment, `PSC` contactless card payment, `MOB` mobile card payment, `MDT` SEPA mandate id, `ECH` instalment (échéance), `ECH PRET` loan instalment, `AVOIR` card refund, `PAYWEB` Crédit Mutuel virtual card, `FRAIS`/`COTISATION`/`COMMISSION` bank fees.
- `packages/api/src/categorisation/normalise/institutions/countries/fr.ts › CENTURY_PREFIX` — French bank descriptors carry no century digit, so two-digit years are expanded with a fixed `20`.
- `packages/api/src/categorisation/normalise/institutions/countries/fr.ts › BOURSORAMA_TRAILING_LOCATION_RE` — Boursorama appends a backslash-delimited location after the merchant name (`MONOPRIX\PARIS 15\ FR`).
- `packages/api/src/categorisation/normalise/institutions/countries/index.ts` — every supported country's institutions, channel verbs and trailing-noise patterns are flattened once at module load, and the flattened lists are country-blind: a descriptor is parsed against every country's verb table regardless of the transaction's country. Only `InstitutionDef` matching (BIC prefix, group or name substring) narrows a parse.

### Dictionary

- `packages/api/src/categorisation/dictionary.ts › loadedScopeCovers` — batches share one module-global map, so a narrower load must never satisfy a wider caller: two concurrent batches in different countries would otherwise inherit whichever filter loaded first. A `loadedScope` of `null` covers every request; a widening rebuild publishes a superset map, so a batch still reading the previous map stays correct.
- `packages/api/src/categorisation/dictionary.ts › ensureLoaded` — the new load is assigned to `state.loading` _before_ it is awaited and chains behind the in-flight one, so a concurrent caller queues instead of starting a second decompression, and `widenTo` re-tests the scope once the queue settles.
- `packages/api/src/categorisation/dictionary.ts › lookupDictionary` — populates the module cache without incrementing `openBatches`, so it loads outside the reference-count protocol, and it asks for `EVERY_COUNTRY` (`null`, every country) because a lookup outside a batch has no scope and a narrower load would risk a false miss. A test that calls it leaves the real artifact resident for later files, which is why the dictionary tests call `unloadDictionary()` in `beforeEach` and `afterEach`.
- `packages/api/src/categorisation/dictionary.ts › DATA_DIR` — the loader once resolved one directory above the package's own `data/`, found nothing and logged only a warning, turning every stage-3 lookup into a miss. `dictionary.test.ts` guards that path: the fixture must occupy the real artifact path, the build output is renamed aside for the run, and `beforeAll` restores an interrupted run's backup first because the artifact is gitignored and a second rename would destroy the only copy.
- `packages/api/src/categorisation/dictionary.ts › indexMerchantLine` — a stored category can predate either taxonomy change, so it is decoded through `resolveCategorySlug` rather than rejected: the artifact outlives the code that built it, and both the pre-hierarchy and the two-level spellings still resolve. A malformed line is skipped silently and never fails the batch.
- `packages/api/src/categorisation/verify.ts › ALGORITHM_FROM_KEY` — `node:crypto`'s `verify(null, …)` takes the algorithm from the key itself, which is Ed25519 (`packages/api/scripts/generate-signing-key.ts`). Verification fails closed: with no `DICTIONARY_PUBLIC_KEY`, `verifySignature` returns false before it looks at anything.
- `packages/api/src/categorisation/merchant-scope.ts › isWorldwide` — an empty `countries` array asserts _worldwide_, not "belongs nowhere", so it is the widest scope: it absorbs any narrower one on merge and survives every country filter. A source that stated no scope (Wikidata with no `P17`) must be omitted from the merge, never passed as `[]`, which would erase every sibling's real scope.
- `packages/api/src/categorisation/merchant-scope.test.ts › mergeCountryScopes` — the evidence behind that rule. NSI ships McDonald's as worldwide in seven categories and US-scoped in others, so a merge that narrowed would hide it from every batch but those. Adidas is worldwide in NSI and `P17=DE` in Wikidata: a Wikidata country of origin says where a brand comes from, not where it trades, and must never narrow a scope.
- `packages/api/src/categorisation/supported-countries.ts › SUPPORTED_COUNTRIES` — a country belongs here once it has keyword heuristics and institution profiles; a per-country merchant dictionary is optional. It is **not** the geographic scope used for place-token generation, which is deliberately broader. Adding a country is one keyword module plus one entry in each of `keywords/index.ts › registry` and `normalise/institutions/countries/index.ts`, whose `satisfies Record<SupportedCountry, …>` tables fail to compile when they drift from this list.

### Scoring and recurrence

- `packages/api/src/categorisation/deterministic.ts › MCC_CONFIDENCE`, `RULE_CONFIDENCE` — an MCC outranks a keyword rule because the card network assigned the code to the merchant; it is not parsed text. A curated country rule sits one step below an exact merchant match.
- `packages/api/src/categorisation/deterministic.ts › deterministicCategory` — the keyword table reads the provider's bank transaction code alone. A regular expression over a descriptor or a counterparty name guesses a merchant from free text, which is the job of the dictionary (whole-merchant match) and of the classifier (a model that reads the whole payment); the tables kept firing `netflix` inside an unrelated label and could not be ranked against either.
- `packages/api/src/categorisation/deterministic.test.ts › "names no category for a word that only says money moved"` — Powens reports its own transaction type as the bank transaction code, so a salary credit arrives as `transfer`. No keyword rule names a movement any more: a transfer between the reader's own accounts is `isInternalTransfer`, and a transfer to anyone else is `people`, which a bare `VIREMENT` is no evidence for. The test pins the credit and the debit reading of each such word, because the old protection was the direction check and that only covered the credit.
- `packages/api/src/categorisation/resolve.ts › merchantKeyCandidates` — only the _tail_ of a merchant key is stripped, and only known service words. Matching any window of the key would read `forfait mobile` as the fuel brand Mobil, and `t mobile` is a brand where `mobile` alone is not.
- `packages/api/src/categorisation/types.ts › ResolutionBand` — `auto` is displayed without hedging, `suggest` may show a prompt, `unknown` is an honest "uncategorised". An unconfident classifier yields `unknown` rather than a forced guess.
- `packages/api/src/categorisation/internal-transfer.ts › pairedLegIds` — opposite sign, equal absolute amount, different account, same currency and dates within one day is sufficient; no IBAN is needed. Candidates deliberately include already-categorised transactions, because a transfer counted as income or expense wrecks the budget figures; only `categoryOverride` rows are excluded.
- `packages/api/src/categorisation/internal-transfer.ts › matchInternal` — the `updateMany` writes `isInternalTransfer` and nothing else. A movement between the user's own accounts is a transaction _type_, not a category, so there is no `internal-transfer` slug to write; the boolean is what every aggregate and the pipeline's own row selection read. Nothing else clears the category a leg already carries, and the flag keeps it out of the figures either way.
- `packages/api/src/categorisation/user-override.ts`, `internal-transfer.ts`, `recurrence.ts` — a categorisation-stage failure must never break a transaction sync or a read. The override write swallows its error, transfer matching reports zero matches, and recurrence detection reports empty aggregates.
- `packages/api/src/categorisation/recurrence.ts › recurringFrom` — a group's reported category is the modal value of each row's `category ?? resolvedCategory`, so one corrected transaction cannot flip the group, and a stored slug that no longer resolves degrades to `uncategorised` rather than dropping the group. `uncategorised` is also the reader-facing `Other` category, so a degraded row reads as an honest catch-all rather than as a blank.

### The classifier

- `packages/api/src/categorisation/classifier/types.ts › ClassificationInput` — the complete allow-list of what may reach a provider: merchant spelling, counterparty, merchant category code, direction, a bucketed amount, currency, country, channel and path. No exact amount, no date, no IBAN, no raw descriptor, and no account or user identifier may ever be added to it.
- `packages/api/src/categorisation/classifier/payload.ts › classificationInputFrom` — the merchant key of an IBAN-path transaction _is_ the creditor IBAN (`merchant-key.ts › merchantKeyOf`), so it is dropped rather than sent: such a payment is identified to a provider by its normalised descriptor and its counterparty name alone. That also keeps the IBAN out of the signature, whose rows are shared by every user of the instance and would otherwise let anyone holding an IBAN test whether it has been seen.
- `packages/api/src/categorisation/classifier/signature.ts › classificationSignature` — the amount bucket, the currency, the counterparty, the channel and the path are deliberately outside the hash: they describe one payment, while the cache answers for a merchant identity. Keying on them would ask the same merchant again for every bucket. The provider, the model string and `TAXONOMY_VERSION` are inside it, so renaming or re-parenting a slug invalidates every stored answer instead of decoding into a category that moved. That head is also what gives each classifier of a cascade its own row: a weak first answer stays cached while the escalation's answer is cached beside it, so a second batch calls neither.
- `packages/api/src/categorisation/classifier/signature.ts › payloadSignature` — grouping a batch must not depend on which classifier is configured, so the in-memory group key hashes the merchant identity alone. It is never stored: a row keyed on it would answer for every provider at once, which is exactly what the provider-scoped cache exists to prevent.
- `packages/api/src/lib/taxonomy.ts › TAXONOMY_VERSION` — bump it whenever a slug is added, removed or re-parented. Nothing else invalidates the classification cache.
- `packages/api/src/categorisation/classifier/store.ts › MerchantClassification` — the row holds the hash and the answer, never the merchant key or the descriptor, which is what lets one table serve every user without leaking one account's merchants to another. A null `category` is an explicit abstention and is cached too, because re-asking a merchant the model already declined costs money for the same answer; `ABSTENTION_RETRY_AFTER_MS` in `resolve.ts` is what stops that from being permanent.
- `packages/api/src/categorisation/classifier/questions.ts › QUESTIONS_BY_DIRECTION` — one question, not a group question and a leaf question per group. The cascade existed because 75 categories under 16 groups made a flat option list unusable; 27 categories do not, and greedy two-stage search cannot recover from a wrong group. The two sets are built at module load from `categoriesForDirection`, so a model is never offered a category the picker would refuse on that transaction.
- `packages/api/src/categorisation/classifier/questions.ts › CATEGORY_CRITERIA` — a rubric per option rather than its label, because `Other`, `People` and `Shopping` carry no meaning alone. It sits beside the question rather than in `lib/taxonomy`, whose labels are what a reader sees. Every provider shares this one text: the system-one question sends it as the option criteria, the llm prompt prints it after each letter, and the zero-shot request sends the rubrics themselves as the candidate labels. A cross-encoder scores an entailment, and the slug `people` entails nothing.
- `packages/api/src/categorisation/classifier/confidence.ts › concentration` — one statistic for every provider, `1 - H(p)/ln(n)` over the offered options, which is what TypeSafe reports as `confidence` and what decider reports as `certainty`. A raw probability for the picked option falls as options are added, so a threshold on one is a threshold on the size of the taxonomy; a product of two such probabilities across two questions is worse again. `n` is always the offered count, never the number of weights the endpoint returned, or a truncated answer would look sharper than a complete one. The two vendors disagree on what the field named `confidence` means, which is why `system-one` prefers `certainty` when the temperature is neutral, and recomputes the statistic from `probabilities` only when an operator fitted a temperature. Recomputing it unconditionally would be worse, not better: an endpoint that returns the picked option alone has an entropy of zero over one weight, and would read as perfectly certain.
- `packages/api/src/categorisation/classifier/confidence.ts › ACCEPT_CONFIDENCE` — `0.5` for every provider, and comparable across them precisely because they all report the same statistic. A cascade threshold that met a per-provider definition of confidence would compare two different quantities and escalate on noise.
- `packages/api/src/categorisation/classifier/providers/llm.ts › TABLE_BY_DIRECTION` — the options are lettered because a slug spans several tokens, and a distribution can only be read at one position. `top_logprobs` is asked for at the option count, which is 20 on a debit: that is also the ceiling most OpenAI-compatible servers accept, so the debit set fits with no headroom. A wider taxonomy would need a different readout, not a bigger request.
- `packages/api/src/categorisation/classifier/confidence.ts › UNDISTRIBUTED_CONFIDENCE` — an `llm` endpoint that returns no log probabilities still answers, at exactly `ACCEPT_CONFIDENCE`, so its answer can only ever suggest a category. Asking the model to state its own confidence would be cheaper and is refused: a chat model's stated number is uncorrelated with its accuracy, and at `0.85` it would write a wrong category into a budget with no reader in the loop.
- `packages/api/src/categorisation/resolve.ts › contradictsDirection` — the invariant belongs to the resolver and not only to the provider, because every stage can produce a category and only the picker's own rule decides what a transaction may hold. A category the user cannot select on that row must never be written to it.
- `packages/api/src/categorisation/deterministic.ts › accepted` — the merchant category code branch runs through the same refund guard as the bank code branch. A refund at a supermarket reports MCC 5411, and the unguarded branch used to file it under `groceries`; rejecting it inside the function, rather than at the resolver, lets the bank code table still answer.
- `packages/api/src/categorisation/classifier/providers/system-one.ts › classifyWith` — every provider ends the same way: a genuine abstention resolves to `null`, and an unreachable endpoint, a refused request, an undecodable answer and a category outside the offered set all reject. The distinction is load-bearing rather than cosmetic, because `consultClassifier` caches a `null` as an abstention for `ABSTENTION_RETRY_AFTER_MS`. A provider that swallowed a `429` into `null` would freeze one outage into 30 days of silence, and in a cascade it would shift every merchant onto the escalation at the escalation's price.
- `packages/api/src/categorisation/resolve.ts › consultClassifier` — a failure, a timeout and an answer outside the taxonomy are never written to the store: caching them would freeze a transient provider fault into a permanent abstention. A store failure is swallowed for the same reason a user-override write is: a categorisation stage must never break a sync.
- `packages/api/src/categorisation/classifier/endpoint.ts › CLASSIFIER_REQUEST_TIMEOUT_MS` — 10 seconds, inside the resolver's own `CLASSIFIER_TIMEOUT_MS` of 15. The inner abort is what normally fires, and it arrives as a provider failure with a reason; the resolver's timeout is the outer guard for a provider that hangs without honouring its own signal. Raising the inner value above the outer one would make every slow call look like a resolver timeout and lose the reason.
- `packages/api/src/categorisation/resolve.ts › resolveGroup` — the escalation bar defaults to `AUTO_BAND_MIN_CONFIDENCE`, so the chain asks a second model exactly when the first answer could not be written without a reader confirming it. The strongest answer wins rather than the last one: a fallback exists to rescue a weak answer, never to overrule a strong one. A cached low answer still escalates, which is what lets a chain of a cheap local model and a paid one settle a merchant permanently after one paid call.
- `packages/api/src/categorisation/classifier/registry.ts › ClassifierSlotSettings` — a slot names a protocol and carries its own URL, model, key and temperature, and there is no per-vendor variable set. TypeSafe Jev, `Mapika/decider-2b` and Laya all answer the one `/v1/systemone` request, so a vendor-named provider would have been three copies of one code path with three copies of its configuration. The slot shape is also what lets one chain hold two endpoints of the same protocol, which a vendor enum cannot express: a local decider that escalates to hosted Jev is the shape this pays for.
- `packages/api/src/categorisation/classifier/registry.ts › createClassifierChain` — a fallback that repeats both the protocol and the model of the first slot stops the start. The signature head is the protocol and the model, so both slots would hash to one row: the escalation would read the row it had just written and answer nothing, at twice the latency. Two endpoints of one protocol are legitimate, and each must name its own model.

### Reference data

- `packages/api/src/categorisation/nsi/location-scope.ts › resolveNsiCountries` — NSI's `locationSet.include` is a mixed bag: ISO 3166-1 alpha-2 codes, ISO 3166-2 subdivisions, UN M49 region codes (`001` world, `150` Europe, `419` Latin America), NSI's own region filenames (`fr-ara.geojson`), inline GeoJSON geometry, free text (`conus`), and codes that are not ISO at all. Everything it cannot fold to a country is dropped, and an empty result means the brand is unscoped, never excluded.
- `packages/api/src/categorisation/nsi/location-scope.ts › NSI_CODE_FOR_METROPOLITAN_FRANCE` — only `fx` is folded onto an ISO code. It carries more French brands than `fr` itself, and dropping it leaves the French scope at roughly a third of its real size. NSI's other non-ISO spellings (`el` Greece, `ra` Argentina, `pi` Philippines, `kv` Kosovo) are left to fail validation, and `ja` **must** fail: it means Japan in some entries and Jamaica in others, so folding it would invent a fact.
- `packages/api/src/categorisation/nsi/location-scope.ts › namesAnIsoRegion` — `Intl.DisplayNames.prototype.of` echoes back any code it knows nothing about, so `of(code) !== code` is the only membership test available. It also throws `RangeError` on anything that is not a well-formed region subtag, which would abort the whole dictionary build, so `WELL_FORMED_REGION_SUBTAG` lets only two-letter tokens reach it.
- `packages/api/src/categorisation/intermediaries/detect.ts › SCHEME_PERMITTED_ACQUIRER_PREFIX_WIDTHS` — Visa and Mastercard scheme rules permit an acquirer prefix of 3, 7 or 12 characters before the asterisk (Chase Paymentech and Worldpay descriptor format rules). An asterisk at one of those raw offsets corroborates a marker match and promotes medium confidence to high; `hasSchemeDocumentedPrefix` records the intermediaries whose own prefix convention is scheme-documented, for which a marker match alone is enough.
- `packages/api/src/categorisation/intermediaries/detect.ts › detectIntermediary` — returns `null` rather than a weak guess, and `IntermediaryConfidence` has no `low` member: a wrong intermediary attribution is worse than none.
- `packages/api/src/categorisation/intermediaries/catalogue.ts › INTERMEDIARY_CATALOGUE` — each key is the `intermediaryId`, and it is never persisted: the only stored field is `Transaction.intermediaryName`. Renaming a key is therefore safe, while renaming a `name` changes what stored rows mean.
- `packages/api/src/categorisation/keywords/anchor.ts › wholeTokenPattern` — `\b` is ASCII-only, so a leading `\b` can never fire before `överföring` or `impôt`. The lookarounds are `\p{L}`/`\p{N}` aware instead, which the bank-code table needs both ways: a provider writes several codes in one string, and an unanchored pattern would fire on a substring of the wrong one.
- `packages/api/src/categorisation/keywords/default.ts › bankCodeKeywords`, `keywords/fr.ts › bankCodeKeywords` — the tables shrank with the taxonomy: `default.ts` went from 6 rows to 3 and `fr.ts` from 5 to 3. Two kinds of row went. The insurance rows had no category left to name, because the flat set files a policy under the thing it insures and a bank code says which policy no more than a brand name does. The transfer rows named a movement rather than a purpose: `isInternalTransfer` carries a movement between the reader's own accounts, and a transfer to anyone else is `people`, which a bare `VIREMENT` is no evidence for.
- `packages/api/src/categorisation/keywords/default.ts › merchantQualifiers`, `keywords/fr.ts › merchantQualifiers` — these are the service words banks append _after_ a brand (`free mobile`, `edf electricite`), which is why `resolve.ts › merchantKeyCandidates` strips them from the tail of a missed merchant key and never from the middle.
- `packages/api/src/categorisation/keywords/index.ts › DEFAULTS_ONLY_TABLES`, `TABLES_BY_COUNTRY` — the layers are concatenated once at module load because `keywordsFor` runs per transaction and must never spread on a call. The repository-wide rule behind that is in `AGENTS.md`: no Effect fiber per row in this package, `Option`, `Result`, `Match` and `Predicate` only.
- `packages/api/src/categorisation/keywords/index.ts` — this subtree imports only `lib/taxonomy`, `supported-countries` and `anchor`, and nothing else may be added: `deterministic.ts` imports both this subtree and `lib/mcc-categories`, so an import from under `keywords/` that reaches either would close a cycle.
