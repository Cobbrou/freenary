---
title: How transactions get categories
description: The steps Freenary tries, in order, to put a transaction in a category.
---

This page explains how Freenary picks a category for each imported transaction: when it runs, the order of the steps, and what the optional classifier adds. The code lives in `packages/api/src/categorisation`.

## When categorisation runs

Categorisation runs after each sync of a member's banks, in three phases:

1. Freenary imports the new transactions. When it imports a transaction, it derives a merchant key: a short, normalised merchant name built from the bank's description.
2. It looks for internal transfers between the member's own accounts.
3. It categorises every transaction that has no category yet, that the member did not categorise by hand, and that is not an internal transfer.

The sync button on **Transactions**, labelled **Sync transactions**, first clears every category the pipeline wrote for that member, except internal transfers and categories set by hand, so the whole history goes through the steps again. A later sync also clears the result of a transaction whose merchant key changed.

## Internal transfers come first

A member with at least two accounts can move money between them. Freenary pairs an outgoing and an incoming transaction when they have the same amount, the same currency, sit on two different accounts, and are booked at most 24 hours apart. Both legs are marked as an internal transfer and skip categorisation. Transactions the member categorised by hand are never paired.

## The steps, in order

For each remaining transaction, Freenary tries these steps and stops at the first one that gives a category. Each step also records a confidence between 0 and 1 and its own name, the stage.

| Order | Stage | Source | Confidence |
| --- | --- | --- | --- |
| 1 | `channel` | The kind of transaction: a cash withdrawal becomes `cash-withdrawal`, a bank fee `loans-bank-fees`, and a cheque stays `uncategorised` | 0.9 |
| 2 | `user-override` | The member's own correction for this merchant key | 1 |
| 3 | `dictionary` | The merchant dictionary | 0.85 |
| 4 | `mcc` | The merchant category code, a four-digit code card networks attach to a payment | 0.8 |
| 5 | `rules` | Keyword rules on the bank's transaction code, such as `loyer` for rent in France | 0.75 |
| 6 | `model` or `cached-model` | The classifier, when one is configured | From the classifier |

Steps 2 and 3 need a merchant key. A step never puts money coming in under a category meant for spending only: such a match counts as no match, and the next step runs.

When no step gives a category, the transaction stays uncategorised.

## Corrections

When a member sets the category of a transaction, Freenary keeps that category on the transaction and records a correction for the member and the merchant key. It copies the category to the member's other transactions with the same merchant key, except those set by hand. Every later transaction from that merchant gets the category at step 2.

Corrections belong to one member. Clearing the category deletes the correction and clears the categories it wrote, so the next categorisation runs the steps again for those transactions.

The category a member sees is the one set by hand when there is one, then the one the pipeline wrote, then `uncategorised`.

## The merchant dictionary

The dictionary is the file `packages/api/data/merchants.jsonl.gz`, shipped in the server image and built by `packages/api/scripts/build-merchant-dictionary.ts`. It maps merchant names and their aliases to categories. The server loads it into memory, keeping only merchants that operate worldwide or in the countries of the banks being categorised.

A lookup tries the merchant key first. When that misses, it drops trailing qualifier words one at a time and tries again, as long as at least three characters remain. The qualifiers depend on the country: in France, words such as `abonnement`, `energie` or `france`.

Signature checks are off by default. When `DICTIONARY_PUBLIC_KEY` holds an Ed25519 public key, the server loads the dictionary only if a signature file, `merchants.jsonl.gz.sig`, sits next to it and matches the key. Otherwise it logs `Dictionary signature missing:` or `Dictionary signature invalid:`, refuses the file, and categorises without a dictionary. The published server image ships no signature file. A contributor creates a signing key with `bun run generate:key` in `packages/api`, and the build script signs the file with it.

## The classifier

The classifier is optional. [Enable transaction categorisation](../how-to/enable-transaction-categorisation.md) sets it up. Only transactions that no earlier step categorised reach it.

### What it receives

Freenary groups the waiting transactions: transactions that share the merchant key (or, without one, the description), the country, the direction and the merchant category code make one question. It asks up to four questions at a time. A request carries the merchant key, the normalised description, the counterparty name, the country, the currency, the direction (money in or out), the merchant category code, the channel, whether it is a card or a bank-transfer payment, and a size band for the amount instead of the amount itself. For a bank transfer identified by account number, the merchant key is left out.

### Answers, abstentions and failures

Freenary drops an answer below 0.5 confidence, which counts as an abstention: the classifier declines to answer. It also refuses an answer with an unknown category, a confidence outside 0 to 1, or a category that contradicts the direction of the money, and logs `answered outside the contract`.

Each answer and each abstention is cached in the `merchant_classification` table, shared by the whole instance. The cache key covers the classifier protocol, the model, the version of the category list, the merchant key or description, the country, the direction and the merchant category code. So changing `TRANSACTION_CLASSIFIER_MODEL` asks every merchant again. A cached answer gives the stage `cached-model`. A cached abstention stops Freenary from asking about that merchant again for 30 days.

A call that fails or runs past the time limit leaves the transaction uncategorised, logs a `[categorisation] classifier` warning, and is not cached, so the next categorisation asks again. The time limit is `TRANSACTION_CLASSIFIER_TIMEOUT_MS` plus a five-second margin.

### The fallback

With `TRANSACTION_CLASSIFIER_FALLBACK` set, Freenary has two classifiers. It asks the first. When that one abstains, fails, or answers under `TRANSACTION_CLASSIFIER_ESCALATE_BELOW`, `0.85` by default, it asks the fallback. The answer with the higher confidence wins. Each classifier has its own cache rows, because its model is part of the key, so the two slots cannot use the same protocol and model.

## Recurring expenses

Recurring-expense detection reads categories, the one set by hand first, then the pipeline's. It does not assign categories.

## Related

- [Enable transaction categorisation](../how-to/enable-transaction-categorisation.md)
- [Configuration](../reference/configuration.md#categorisation)
- [Where settings come from](settings-sources.md)
