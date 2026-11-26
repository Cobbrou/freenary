---
title: How transactions get categories
description: The steps Freenary tries, in order, to put a transaction in a category.
---

This page explains how Freenary picks a category for each imported transaction: when it runs, the order of the steps, and what the optional classifier adds. The code lives in `packages/api/src/categorisation`.

## When categorisation runs

Categorisation runs after each sync of a member's banks, in three phases:

1. Freenary imports the new transactions. When it imports a transaction, it derives a merchant key: a short, normalised merchant name built from the bank's description.
2. It looks for internal transfers between the member's own accounts, and learns the names banks give the member.
3. It categorises every transaction that has no category yet, that the member did not categorise by hand, and that is not an internal transfer.

The sync button on **Transactions**, labelled **Sync transactions**, first clears every category the pipeline wrote for that member, except internal transfers and categories set by hand, so the whole history goes through the steps again. A later sync also clears the result of a transaction whose merchant key changed.

**Re-categorise all**, under **Re-categorise transactions** in **Settings** › **Categories**, starts over without asking the banks for new transactions. It clears everything the pipeline wrote on every transaction the member did not categorise by hand, internal transfers included, then looks for internal transfers over the whole history and runs the steps below, as for a new transaction. Transactions categorised by hand keep their category. It runs in the background and shows the same progress, **Sorting transactions into categories**. It does not start while a sync is running, and a sync does not start while it runs.

## Internal transfers come first

An internal transfer is money that moves between two accounts of the same member: two accounts linked to Freenary, two currencies of one account, or a linked account and one the member holds at a bank they did not link. Freenary marks such a transaction as an internal transfer, files it under the category `internal-transfer`, shown as **Transfer between my accounts** in the **Transfers** group, and it skips the steps below. Transactions the member categorised by hand are never marked, and neither are the transactions of a loan account. The code lives in `internal-transfer.ts` and `own-counterparty.ts`.

### Pairs of linked accounts

Freenary pairs an outgoing and an incoming transaction when they have the same amount, the same currency and sit on two different accounts. Legs in two different currencies pair when their amounts match at the bank's rate or within 3% at the reference rate, as [How currencies are converted](currencies.md#exchanges-and-transfers-between-currencies) explains. Both legs are marked.

Amounts and dates can match by chance, so Freenary also compares IBANs, ignoring spaces and case, and the names of the two sides. An outgoing transaction can name the IBAN the money went to, and an incoming one the IBAN it came from:

- When a transaction names an IBAN, the two pair only if at least one names the IBAN of the other account, and none names a different one. Such a pair is confirmed, and its legs can be booked up to 4 days apart, as a transfer to another bank often arrives a day or more later.
- When neither names an IBAN but both accounts have a different one, they pair only if at least one leg names the member, as [below](#the-names-of-the-member) explains, and no leg names someone else. These legs can also be up to 4 days apart.
- When nothing names the member either, they still pair if the money reached an account only its holder pays into: a savings account, a life insurance, a PEA, a compte-titres, crowdlending or real estate, and the outgoing leg is a transfer, not a card payment or a direct debit. These legs can also be up to 4 days apart. A retirement plan or an employee savings plan does not count here, as an employer pays into it too.
- When neither names an IBAN and the accounts share an IBAN, as with an account that holds two currencies, or at least one account has none, the amount, the currency and the date decide. These legs are booked at most 24 hours apart.

Confirmed pairs are made first, then pairs a name confirms, then pairs into an account only its holder pays into, then the others.

A transaction marked on its own by its counterparty, as below, stays a candidate: when the other leg arrives on a linked account in a later sync, the two pair, and the transaction takes the category of the account the money reached.

### One transaction on its own

A transaction is also marked on its own, without its other leg:

- when the IBAN it names is the IBAN of another linked account of the member. The other leg can arrive later, or come from an account whose bank gives no IBAN.
- when the IBAN it names is one the member marked as their own.
- when the name of the person on the other side is one of the [names of the member](#the-names-of-the-member). When the bank gives no name for the other side, a merchant key made only of a name of the member, such as `m marius nouchet` or `vers m marius nouchet`, counts as that name. Only a transfer, or a transaction whose kind Freenary cannot tell, is marked by its name: never a card payment, a direct debit, a cheque, a cash withdrawal, a fee or a loan repayment.

Freenary does not mark a transaction by its name, or by a counterparty the member marked, when the member picked another category than **Transfer between my accounts** for its merchant key: the correction wins.

### The names of the member

Banks name the person on the other side of a transfer in their own way, such as `M DUPONT JEAN` or `Jean Dupont`. Freenary compares names after removing accents, case, titles such as `M`, `MME` or `MR`, and the order of the words, so these two names are the same. The member's names are:

- their first and last name, from **Settings** › **Profile**, when they have both. Freenary reads it at each matching, so a change applies from the next sync or **Re-categorise all**;
- the name of the holder of each linked account, as the bank gives it at each sync. With Powens, Freenary keeps only the holders Powens identifies as the person who connected the bank, or the only holder of an account that has one; when Powens offers no account ownerships, it keeps none. With Enable Banking, it keeps the account's holder name, unless the member is an attorney on the account. Freenary stores these names in the `own_counterparty` table;
- every name, of at least two words, a bank gave the other side of a transfer an IBAN confirmed: a transaction naming the IBAN of another linked account, or a leg of a confirmed pair. Freenary stores these names in the `own_counterparty` table;
- the names the member marked as theirs, as below.

### Filing a transfer by hand

**Transfer between my accounts** is a category like the others in the category picker, under **Transfers**. The member picks it for a transfer Freenary missed.

- The transaction keeps its category through later syncs, as any category set by hand. If it was an internal transfer already, it stays one.
- Freenary remembers the IBAN and the name of the other side as the member's, or its merchant key when it has neither. Later transfers with that IBAN or name become internal transfers.
- As with any category, Freenary records a correction for the merchant key and copies the category to the member's other transactions with that merchant key.

When the member picks another category for an internal transfer, or for a transaction under **Transfer between my accounts**:

- An internal transfer stops being one: it counts as any other transaction again, and later syncs do not mark it. The other leg of a pair stays an internal transfer until the member sets its category too. Clearing the category lets a later sync mark the transaction again.
- For a category of **Savings & investment**, Freenary only forgets the counterparties the member marked as their own for that transaction.
- For any other category, Freenary remembers that the IBAN and the name of the other side are not the member's. The transactions it marked only because of them stop being internal transfers, and Freenary sorts them into categories again.
- The other transactions of the same merchant key that were marked only by their name or their counterparty stop being internal transfers and take the new category.

### Categories of internal transfers

When the money leaves a current account for a linked savings, investment or retirement account, the current-account leg gets the category `savings`, `securities` or `retirement`, with the stage `internal-transfer`. [How account types change the totals](account-types.md#transfers-between-your-own-accounts) lists which account gives which category. Any other internal transfer gets `internal-transfer`, with the stage `internal-transfer`, or `own-counterparty` when Freenary marked it by its counterparty alone. A transfer to or from an account that is not linked never gets a savings category: Freenary does not know what kind of account it is.

Every figure leaves out the transactions under **Transfer between my accounts**, whether Freenary or the member put them there. The **Transfers** group takes no budget line and no custom category.

## The steps, in order

For each remaining transaction, Freenary tries these steps and stops at the first one that gives a category. Each step also records a confidence between 0 and 1 and its own name, the stage.

| Order | Stage | Source | Confidence |
| --- | --- | --- | --- |
| 1 | `channel` | The kind of transaction: a cash withdrawal becomes `cash-withdrawal` and a bank fee `loans-bank-fees` | 0.9 |
| 2 | `user-override` | The member's own correction for this merchant key | 1 |
| 3 | `dictionary` | The merchant dictionary | 0.85 |
| 4 | `mcc` | The merchant category code, a four-digit code card networks attach to a payment | 0.8 |
| 5 | `rules` | Keyword rules on the bank's transaction code, such as `loyer` for rent in France | 0.75 |
| 6 | `model` or `cached-model` | The classifier, when one is configured | From the classifier |

Steps 2 and 3 need a merchant key. Only the member's correction and the classifier can give `internal-transfer`: a dictionary entry, a merchant category code or a keyword rule that gives it counts as no match. A step never puts money coming in under a category meant for spending only: such a match counts as no match, and the next step runs. A dictionary entry or a merchant category code that gives `uncategorised` also counts as no match, so the transaction still reaches the classifier.

When no step gives a category, the transaction stays uncategorised. With a `system-one` classifier, that only happens when the classifier fails or the transaction carries no merchant key, description or counterparty name.

## Transactions to check

A classifier answer under the confidence that would make it automatic, `0.85`, still gives the transaction its category, but Freenary flags it as low confidence. Only transactions booked in the last 60 days are flagged, so connecting a bank or syncing the whole history does not flag older transactions; they keep their category. After each categorisation that flags such transactions, Freenary sends the member one notification, such as **7 transactions to check**, that holds the transactions flagged in that run. A transaction already held by another notification is not added again.

The notification center sits at the bottom of the sidebar, under **Notifications**, with the number of unread notifications next to it. Opening this notification opens the **Transactions to check** panel. Each row has a category picker and a check mark. The check mark keeps the category and picking another category changes it: both record a correction, as below, so the row leaves the list. **Dismiss all** in the panel empties the list without changing any transaction. Once the list is empty, the notification goes away.

Dismissing the notification leaves the transactions as they are, and **Undo** in the message that follows brings it back. Freenary deletes read notifications after 30 days.

## Corrections

When a member sets the category of a transaction, Freenary keeps that category on the transaction and records a correction for the member and the merchant key. It copies the category to the member's other transactions with the same merchant key, except those set by hand. Every later transaction from that merchant gets the category at step 2.

Corrections belong to one member. Clearing the category deletes the correction and clears the categories it wrote, so the next categorisation runs the steps again for those transactions.

The category a member sees is the one set by hand when there is one, then the one the pipeline wrote, then `uncategorised`.

### Suggestions while picking a category

The category picker in the transaction details filters the categories by the text typed into it. When the classifier is TypeSafe Jev, it also sends that text to Jev 300 milliseconds after the last keystroke, once at least two characters are typed, and lists up to three categories Jev ranks for it under **Matches with**. Jev receives the normalised text as merchant key and description, the direction and currency of the transaction, the `small` amount band, and no country, channel or merchant category code. A category under 0.05 probability is left out. These answers are not cached in `merchant_classification` and assign nothing on their own. A failed call shows no suggestions and logs a `[categorisation] suggestions` warning. With any other classifier, or none, the picker only filters.

## The merchant dictionary

The dictionary is the file `packages/api/data/merchants.jsonl.gz`, shipped in the server image and built by `packages/api/scripts/build-merchant-dictionary.ts`. It maps merchant names and their aliases to categories. The server loads it into memory, keeping only merchants that operate worldwide or in the countries of the banks being categorised.

A lookup tries the merchant key first. When that misses, it drops trailing qualifier words one at a time and tries again, as long as at least three characters remain. The qualifiers depend on the country: in France, words such as `abonnement`, `energie` or `france`.

Signature checks are off by default. When `DICTIONARY_PUBLIC_KEY` holds an Ed25519 public key, the server loads the dictionary only if a signature file, `merchants.jsonl.gz.sig`, sits next to it and matches the key. Otherwise it logs `Dictionary signature missing:` or `Dictionary signature invalid:`, refuses the file, and categorises without a dictionary. The published server image ships no signature file. A contributor creates a signing key with `bun run generate:key` in `packages/api`, and the build script signs the file with it.

## The classifier

The classifier is optional. [Enable transaction categorisation](../how-to/enable-transaction-categorisation.md) sets it up. Only transactions that no earlier step categorised reach it.

### What it receives

A transaction with neither a merchant key nor a description is described by its counterparty name instead. Freenary groups the waiting transactions: transactions that share the merchant key (or, without one, the description), the country, the direction and the merchant category code make one question. It asks up to four questions at a time. A request carries the merchant key, the normalised description, the counterparty name, the country, the currency, the direction (money in or out), the merchant category code, the channel, whether it is a card or a bank-transfer payment, and a size band for the amount instead of the amount itself. The band is worked out on the amount converted into euros at the rate of the transaction date, or on the amount as booked when no rate exists. For a bank transfer identified by account number, the merchant key is left out.

### Answers, abstentions and failures

With `llm` or `zero-shot`, Freenary drops an answer below 0.5 confidence or an answer of `uncategorised`, which counts as an abstention: the classifier declines to answer.

A `system-one` classifier does not abstain. Freenary does not offer it `uncategorised`, and keeps its answer whatever the confidence: an answer under `0.85` lands in **Transactions to check**. When the classifier still answers `uncategorised`, Freenary takes the most probable other category from the probabilities it returned. Without probabilities, the answer is outside the contract. It also refuses an answer with an unknown category, a confidence outside 0 to 1, or a category that contradicts the direction of the money, and logs `answered outside the contract`.

Each answer and each abstention is cached in the `merchant_classification` table, shared by the whole instance. The cache key covers the classifier protocol, the model, the version of the category list, the merchant key or description, the country, the direction and the merchant category code. So changing `TRANSACTION_CLASSIFIER_MODEL` asks every merchant again. A cached answer gives the stage `cached-model`. A cached abstention stops Freenary from asking about that merchant again for 30 days, unless the member asks, as below.

A call that fails, runs past the time limit, or answers outside the contract leaves the transaction uncategorised, logs a `[categorisation] classifier` warning, and is not cached. The time limit is `TRANSACTION_CLASSIFIER_TIMEOUT_MS` plus a five-second margin. The server remembers the failure in memory and does not ask about that merchant again for one hour, unless the member asks: **Sync transactions**, **Re-categorise all**, connecting a bank and the `budget.recategorise` procedure ask again at once. A restart forgets the failures.

A categorisation the member did not ask for asks at most 200 questions. Any categorisation stops asking after 5 failures in a row. It logs `[categorisation] classifier phase skipped` with the number of questions it left out, and the next categorisation asks them.

### The fallback

With `TRANSACTION_CLASSIFIER_FALLBACK` set, Freenary has two classifiers. It asks the first. When that one abstains, fails, or answers under `TRANSACTION_CLASSIFIER_ESCALATE_BELOW`, `0.85` by default, it asks the fallback. The answer with the higher confidence wins. Each classifier has its own cache rows, because its model is part of the key, so the two slots cannot use the same protocol and model.

## Recurring expenses

Recurring-expense detection reads categories, the one set by hand first, then the pipeline's. It does not assign categories.

## Related

- [Enable transaction categorisation](../how-to/enable-transaction-categorisation.md)
- [Configuration](../reference/configuration.md#categorisation)
- [Where settings come from](settings-sources.md)
