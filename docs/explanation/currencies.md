---
title: How currencies are converted
description: How Freenary keeps each transaction in its own currency and converts totals into one reporting currency.
---

This page explains how Freenary handles money in more than one currency: what each transaction stores, where the exchange rates come from, how totals are converted, and how exchanges and transfers between currencies count. The code lives in `packages/api/src/fx`.

## Each transaction keeps its own currency

A transaction stores its amount in the currency of the balance it moved, in the `amount` and `currency` columns of the `transaction` table. A card payment made in dollars from a euro account is stored in euros, because the bank converted it. When the bank reports what the purchase was made in, Freenary also stores it in `originalAmount` and `originalCurrency`.

Some banks list a payment from a euro account in the currency it was made in. On import, Freenary moves it back to the account's currency:

- With Enable Banking, it takes the amount the bank gives in the account currency, or converts the reported amount with the rate the bank applied. Without either, the transaction keeps the currency the bank sent.
- With Powens, every transaction is in the account currency. The amount in the original currency comes from `original_value` and `original_currency`.

Amounts are whole numbers of the currency's smallest unit, such as cents, stored as 64-bit integers (`BIGINT`). The server reads them as JavaScript numbers, which hold any amount up to 9,007,199,254,740,991 smallest units exactly; it refuses to read a larger one instead of rounding it.

The transaction list and the transaction details show each amount in its own currency. When an original amount exists, the row shows it under the amount, and the details show **Original amount** and **Exchange rate**.

## Accounts that hold several currencies

An account can hold balances in several currencies, such as a euro balance and a dollar balance at Wise or Revolut. Freenary stores one row per currency in the `account_balance` table. The `currency` and `balanceMinor` columns of `bank_account` keep the main balance. With Enable Banking, the main balance is the one in the account currency the bank reports; a bank that reports `XXX`, the code for several currencies, gets the first balance it lists.

Account balances list every currency the account holds, such as `€1,200.00 · $350.00`.

## The reporting currency

Totals add up money from different currencies, so Freenary converts them into one currency, the reporting currency. Each member chooses it in **Settings** › **Budget** under **Reporting currency**. **Automatic** follows the currency most of the member's current accounts use, and falls back to every account, then to euros. The choice is stored in the `reportingCurrency` column of the `user` table; empty means automatic. The list offers euros and every currency that has an exchange rate.

These figures are in the reporting currency:

- The spending breakdown, budget against actual, fixed against variable, weekly spending, the Sankey diagram and the cash-flow chart.
- The totals of the transaction list and the merchant totals.
- **Available to spend**, **Current accounts**, **Net worth**, the net worth history and the holdings totals.
- The monthly figures of the **Recurring** page and the income it uses.

Budget lines are amounts in the reporting currency. Changing the reporting currency does not change the amounts of the budget lines.

## Where the rates come from

The server downloads the euro foreign exchange reference rates of the European Central Bank from `https://data-api.ecb.europa.eu`. The bank publishes them on every working day, around 16:00 Central European Time, for about 30 currencies. Freenary stores them in the `exchange_rate` table, one row per currency and day, as units of the currency for one euro. A rate between two other currencies goes through the euro.

The server asks for missing days when it starts, every 6 hours, and before it pairs internal transfers after a sync. The first download reaches back two years, or to the oldest transaction when that is older. Later downloads only add the days that are missing. Pages never call the European Central Bank: every conversion reads the stored rates.

When the download fails, the server logs `[exchange-rates] The European Central Bank rates could not be read:` with the reason, keeps the stored rates and tries again 6 hours later. **Settings** shows the date of the last rate under **Reporting currency**.

## Which rate converts what

Freenary prefers the rate the bank applied. When a transaction's original currency is the reporting currency, it uses the original amount as it is. Otherwise it uses the reference rate:

- Spending, income and transaction totals use the rate of the transaction date.
- Current balances, net worth and holdings use the latest rate.
- The net worth history uses the rate at the end of each month.

A day without a rate, such as a weekend or a holiday, uses the last rate before it. Each amount is converted, then rounded once to the smallest unit of the reporting currency.

An amount in a currency with no rate is not counted. The figure then shows a line such as **3 transactions in other currencies aren't included: no exchange rate yet.** The same line exists for balances, accounts, recurring payments and holdings.

## Exchanges and transfers between currencies

[How transactions get categories](categorisation.md#internal-transfers-come-first) explains how Freenary pairs the two legs of a transfer between a member's own accounts. Two legs in different currencies pair too:

- when the bank's original amount on one leg equals the amount of the other leg, or
- when the reference rate of the outgoing leg's date turns its amount into the incoming amount within 3%.

The legs must be booked at most 24 hours apart. They can sit on two accounts, or on the same account when it holds both currencies, as with an exchange inside a Wise or Revolut account. When several outgoing legs match, the closest one wins. The IBAN rules on that page apply to these legs too.

A paired exchange is neither income nor spending. What the exchange cost against the reference rate counts as spending in the `loans-bank-fees` category: the outgoing amount, minus the incoming amount converted back at the incoming leg's rate. Freenary stores it in the `exchangeFeeMinor` column of the outgoing leg, and the transaction details show it as **Exchange cost**. A fee the bank books as its own transaction is categorised like any other payment.

## Other rules that depend on the currency

- **Recurring payments**: a recurring payment is detected from the transactions of one merchant in one currency. When every payment of a merchant has the same original currency, Freenary compares the original amounts, so a $10 subscription charged in euros at a moving rate still reads as a fixed amount. The page shows each payment in its own currency, with the converted amount next to it.
- **Amount filters** on **Transactions**: the amount typed is in the reporting currency, and each transaction is compared on its own amount, scaled to the number of decimals of its currency.
- **Categorisation**: the amount band sent to the classifier is worked out on the amount in euros.

## Related

- [How account types change the totals](account-types.md)
- [How transactions get categories](categorisation.md)
- [How budget months work](budget-months.md)
