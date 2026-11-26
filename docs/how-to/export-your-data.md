---
title: Export your data
description: Download a copy of your financial data as a JSON file.
---

This page gets a copy of your financial data out of Freenary, as one JSON file you keep on your computer. The file holds your data as Freenary stores it, with nothing hidden or replaced.

## Before you start

- An account on a running Freenary instance, with its onboarding finished. Until you connect a bank, every page of the app, **Settings** included, sends you back to onboarding.

## Steps

1. In Freenary, open **Settings**, then **Export**, under **Data**.
2. Next to **Download your data**, select **Download**.
3. Save the file `freenary-export-<date>.json`, where `<date>` is the day of the export, such as `freenary-export-2026-11-26.json`.

## Check that it works

Open the file in a text editor. It holds these two lines:

```json
  "format": "freenary-export",
  "version": 1
```

and these fields, for your account:

| Field | Contents |
| --- | --- |
| `user` | Your name, email, tax countries, budget month settings and reporting currency. |
| `connections` | Each bank connection: the bank's name, country, BIC and group, its status and its last sync. |
| `connections[].accounts` | Each account: name, IBAN, type, currency and balances, its holdings, and every transaction with all its stored fields, categories included. |
| `customCategories` | The categories you created. |
| `merchantOverrides` | The categories you set for a merchant. |
| `budgetLines` | The lines of your budget. |
| `dashboards` | Your dashboards and their widgets. |

The file holds no password, passkey, two-factor secret, session, API key or sign-in account, and none of the handles Freenary uses to reach your bank. Saved filters, notifications and assistant conversations are not in it.

The file contains your name, your account numbers and your transactions as they are. Keep it private.

## If something goes wrong

- **Something went wrong. Try again.** shows after **Download**, and no file downloads: the export failed. Select **Download** again.
- A script calling `dataExport.download` with an API key gets `403` with `An API key cannot export the account's data`. Only a signed-in session in the app can export.

## Related

- [Call the API with an API key](call-the-api.md)
- [Test with your own data](contribute/test-with-your-own-data.md)
