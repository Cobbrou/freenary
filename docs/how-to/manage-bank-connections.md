---
title: Manage your bank connections
description: Change which accounts a bank shares with Freenary, delete an account it no longer shares, or remove a bank.
---

This page helps you change what Freenary keeps from a bank you connected: which accounts the bank shares, the history of an account it no longer shares, and the bank itself.

## Before you start

- An account on a running Freenary instance, with a bank connected, as in [Connect your first bank](../tutorials/connect-your-first-bank.md).
- In **Settings**, **Bank accounts** lists each bank you connected, with its number of accounts and its last sync, and under it each of its accounts with its number of transactions. Each bank has an actions button, **Actions for Mock Bank**. The examples below use a bank named Mock Bank and an account named Joint account; the app shows your own names.

## Steps

### Change which accounts a bank shares

1. In **Settings** › **Bank accounts**, next to the bank, open **Actions for Mock Bank** and select **Edit access**. A bank that reads **Reconnect to resume importing** offers **Reconnect** instead, which goes straight to your bank: skip to step 3.
2. The dialog **Edit access to Mock Bank?** opens. Select **Continue to Mock Bank**.
3. On your bank's page, pick the accounts Freenary can read, and approve.
4. Back in Freenary, if you left out an account your bank shared until now, the dialog **1 account is no longer shared** (or **2 accounts are no longer shared**) lists each one with its number of transactions:
   - Select **Keep history** to keep these accounts and their transactions. Syncs skip them.
   - Or tick the accounts you no longer want, then select **Delete 1 account** (or **Delete 2 accounts**). Freenary deletes them with their transactions, holdings and balances.

An account your bank returns keeps its transactions, and an account it never returned before is added.

### Delete an account your bank no longer shares

An account kept with **Keep history** stays under its bank with the badge **Not shared** and the line **No longer shared with freenary**. Accounts your bank still shares are listed first, without a badge.

1. Next to the account, select **Delete account**.
2. The dialog **Delete Joint account?** says how many transactions go with it. Select **Delete account**.

Only an account your bank no longer shares can be deleted this way: an account it still shares would come back at the next sync. To stop sharing it, use **Edit access** first.

### Remove a bank

1. Next to the bank, open **Actions for Mock Bank** and select **Remove**.
2. The dialog **Remove Mock Bank?** says how many accounts go with it. Select **Remove bank**.

Freenary asks your bank to revoke its access, then deletes the connection with every account, transaction, holding and balance it brought.

## Check that it works

- After deleting accounts, a message reads **1 account deleted** (or **2 accounts deleted**), and the accounts leave **Settings** › **Bank accounts**, **Home** and **Transactions**.
- After removing a bank, a message reads **Mock Bank removed**, and the bank leaves **Settings** › **Bank accounts**.

When a deleted transaction was one leg of a transfer between your accounts, the other leg is checked again, as [How transactions are categorised](../explanation/categorisation.md#when-an-account-is-deleted) explains.

## If something goes wrong

- **Couldn’t delete the account. Try again.** The deletion failed and nothing was deleted. Select **Delete account** again.
- **Mock Bank removed, but freenary could not ask your bank to revoke access. Revoke it from your bank to be sure.** Freenary deleted the bank and its data, but your bank did not confirm the revocation. Revoke the access from your bank's website or app.
- **Could not connect to Mock Bank. Try again later.** after **Continue to Mock Bank**: the bank provider did not open the consent page. Nothing changed. Try again later.
- No dialog appears after **Edit access** although you left an account out. The dialog shows only after the consent that left the account out, in the same tab. Reloading the page Freenary showed after your bank, or opening it again, does not show the dialog again. The account is listed under its bank as **Not shared**: delete it from there.

## Related

- [Troubleshoot](troubleshoot.md#a-bank-stops-importing)
- [Export your data](export-your-data.md)
