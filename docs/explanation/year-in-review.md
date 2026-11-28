---
title: How the year in review works
description: When the year in review opens, which year it shows and where each of its figures comes from.
---

This page explains the **Year in review**: a page, and a story of slides, that sum up where a year's money went. The figures come from `budget.getYearInReview` in `packages/api/src/routers/year-review.ts`, built on `packages/api/src/lib/year-review.ts`.

## When it opens

The year in review opens on 15 December and closes at the end of January, in UTC:

| Date | Year shown first |
| --- | --- |
| 15 to 31 December | The year that is ending, with the note **The year is not over: figures stop at today.** |
| 1 to 31 January | The year that just ended |
| 1 February to 14 December | None: the page shows **Your year in review is on its way** |

While it is open, the year picker lists every year from the one shown first back to the year of the account holder's first counted transaction.

## The notification

When the year in review is open, the notification center raises one `year_in_review` notification, **Your {year} in review is ready**, the first time it loads after 15 December. It does so only for an account holder with a counted transaction in that calendar year. The column `yearInReviewNotifiedFor` of the `user` table keeps the last year notified, so dismissing the notification does not bring it back. The notification and a card on Home open `/year-in-review` on that year. A `year_in_review` notification raised before the current opening is deleted.

## Which days a year covers

The year follows the account holder's budget month rule, as described in [How budget months work](budget-months.md): it is the twelve budget months named January to December. With day 1, that is the calendar year, and the page says **Calendar year, from 1 January to 31 December.** With any other rule, it says **Your budget months, from {from} to {to}.**

## What counts

Every figure counts the same transactions as **Budget**: those of cash-flow accounts, without excluded transactions, transactions of excluded accounts or internal transfers, except transfers to savings, securities and retirement. Amounts are in the reporting currency; a transaction with no exchange rate is left out and counted in the note under the title. See [How currencies are converted](currencies.md).

| Figure | Built from |
| --- | --- |
| **Income**, **Spending**, **Net** | The counted transactions of the year, money in and money out. |
| **Savings rate** | Net plus transfers to savings, securities and retirement, divided by income. |
| **Spending per month** | Money in and out per budget month of the year. |
| **Spending per category** | Money out per category, against the year before. |
| **Top merchants** | The 10 merchants with the most money out, and the 10 with the most payments, grouped by counterparty name. Transfers to savings are left out. |
| **Recurring payments** | Money out of the year to merchants that the recurring payment detection finds as fixed payments over that year, such as rent, bills and subscriptions. Behavioural repeats, such as weekly groceries, are left out. |
| **Net worth** | The balance of every account that is not excluded, at the end of the year before and at each month end of the year, rewound from today's balances. |

## Comparing with the year before

The page shows the change from the year before when that year has counted transactions. When either year has less than 12 budget months with a transaction, the page says **One of the two years has less than 12 months of data, so the changes compare unequal periods.**, and the story leaves the change out.

## The story

**Play your year** opens a story of slides: spending, the top category, the top merchants, the priciest month, the biggest payment, recurring payments, the savings rate and net worth. A slide with nothing to show is skipped. Each slide plays for 6 seconds; a tap on the left third goes back, a tap elsewhere or the right arrow key goes forward, and the pause button stops the timer.

## Related

- [How budget months work](budget-months.md)
- [How currencies are converted](currencies.md)
- [How account types change the totals](account-types.md)
