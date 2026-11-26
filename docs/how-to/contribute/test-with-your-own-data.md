---
title: Test with your own data
description: Turn a data export into an anonymised fixture and replay it through the mock bank.
---

This page turns the data of a real Freenary account into a fixture, a file the mock bank replays on your development stack in place of its generated data. The fixture keeps the amounts, dates and bank texts of every transaction, so categorisation and the charts behave as they do on that account, and it replaces the names and numbers that point to a person.

## Before you start

- A working clone and a development stack, as in [Run from source](run-from-source.md), with the mock bank as bank provider (see [Use the mock bank](run-from-source.md#use-the-mock-bank)).
- An export of the account to reproduce, made as in [Export your data](../export-your-data.md).

## Steps

1. From the repository root, turn the export into a fixture:

   ```bash
   bun run fixtures:create -- ~/Downloads/freenary-export-2026-11-26.json
   ```

   It writes `packages/api/fixtures/freenary-export-2026-11-26.json`. Git ignores that folder: never commit a fixture or attach it to an issue, because the amounts, dates and merchants it keeps can still point to the person.

   The fixture holds the banks, accounts, balances, holdings and transactions of the export:

   | Kept as is | Replaced, the same way everywhere | Left out |
   | --- | --- | --- |
   | Amounts, currencies, exchange rates, balances and dates | IBANs of accounts and transactions, with a valid IBAN of the same country | The holder's email |
   | Bank texts, merchant category codes and bank transaction codes, apart from the replaced words | Names found as described in step 2, wherever they appear | The holder's own notes on transactions |
   | Merchant towns and countries, and company identifiers | IBANs, emails and French phone numbers written in the bank texts | Categories, merchant rules, budget lines, dashboards and budget settings |
   | The bank's name, country, BIC and group, which decide how its texts are read | Reference numbers, card and account identifiers, transaction and holding ids |  |
   | Holdings: name, ISIN, quantity and values |  |  |

   The database keeps one counterparty name per transaction. The fixture gives it back as the creditor on a payment and as the debtor on an income, so an incoming transfer whose bank named both sides can read differently than on the account.

2. Read the report the command prints, then run it again with `--force` and the options below until the report is right:

   - **Names replaced** lists each word the fixture replaces in every text, and its replacement. The words come from the account holder's name, from `--names`, and from the counterparty of each transfer whose name holds a known first name.
   - **Replaced names that card payments use too** lists replaced words that also appear in card payments. A merchant such as `LECLERC` replaced there changes how its payments get categories: pass `--keep LECLERC`.
   - **First names still in the fixture** lists first names the fixture keeps. A person's name among them goes in `--names`, such as `--names "Marie Martin"`; a merchant's or a place's stays.

   | Option | Effect |
   | --- | --- |
   | `--name <name>` | File name of the fixture, without `.json`. Defaults to the export's. |
   | `--names <names>` | Other person names to replace, comma-separated. |
   | `--keep <words>` | Words never to replace, comma-separated. |
   | `--keep-dates` | Replays the transactions on their own dates. |
   | `--seed <secret>` | Makes the replacements the same on every run. Without it, each run picks new ones. |
   | `--force` | Overwrites a fixture with the same name. |

3. Restart the API server: it keeps the list of banks for an hour, and the mock bank lists the new fixture once the server reads it again. With the Docker stack:

   ```bash
   docker restart freenary-<slug>-server-1
   ```

   > **TODO (unverified):** whether Compose watch copies a new file that Git ignores into the `server` container. If the bank does not show up, copy the fixture with `docker cp packages/api/fixtures/<name>.json freenary-<slug>-server-1:/app/packages/api/fixtures/`.

4. In the app, open **Settings** › **Bank accounts**, select **Connect a bank** and pick the bank of the fixture, under its real name. A fixture made from an export with several banks lists each of them.
5. On the mock bank page, which says it replays the accounts and transactions of a fixture file, select **Approve**.

## Check that it works

After the sync, **Settings** › **Bank accounts** shows the bank with the accounts of the export, and **Transactions** shows its history. The mock bank serves the whole history of the fixture on every sync, not only the last 90 days a real bank serves.

Without `--keep-dates`, the mock bank moves every date by whole months, so that the last transaction falls in the current month, or in the previous one when its day is still to come. A salary paid on the 28th stays on the 28th, and the budget months split the history as they did on the account. Dates written inside the bank texts, such as `CARTE 29/08`, stay as they were.

## If something goes wrong

- `<file> is not a Freenary data export:` followed by fields → the file is not an export, or comes from a version of Freenary with another format. Export the data again.
- `<file> already exists. Pass --force to overwrite it.` → a fixture has that name. Add `--force`, or pick another `--name`.
- The server log shows `Mock bank: <file> is not a Freenary fixture, skipped` → the file in `packages/api/fixtures/` was edited by hand or is not a fixture. Create it again with `bun run fixtures:create`.
- A sync fails with `The mock bank has no fixture for fixture-<name>-<n>` → the fixture of that connection was renamed or deleted. Put it back, or remove the bank.

## Related

- [Run from source](run-from-source.md)
- [Export your data](../export-your-data.md)
- [How transactions get categories](../../explanation/categorisation.md)
