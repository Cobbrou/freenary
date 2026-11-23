---
title: How budget months work
description: How the rule a budget month starts on decides which month each transaction counts in.
---

This page explains how Freenary splits time into budget months, and why a salary paid at the end of a month can count in the next one. The rules live in `packages/api/src/lib/budget-month.ts`, which the server and the web app share.

## The start rule

Each account holder picks how their budget month starts, on the **When does your month start?** step of onboarding and later in **Settings** › **Budget** under **Budget month**. Freenary stores the choice in three columns of the `user` table:

| Column | Holds |
| --- | --- |
| `budgetMonthAnchor` | `DAY_OF_MONTH`, `LAST_DAY` or `LAST_WORKING_DAY`. The default is `LAST_WORKING_DAY`. |
| `budgetMonthStartDay` | The day, from 1 to 28, used by `DAY_OF_MONTH`. The default is `1`. |
| `budgetMonthHolidayCountry` | The country whose public holidays `LAST_WORKING_DAY` skips. Empty means the first tax residency country. |

The screens offer the three rules as **Day of the month**, **Last day** and **Last working day**.

## Day of the month

With day 1, a budget month is a calendar month. With a later day, each budget month runs from that day to the day before it in the next month. The choice stops at the 28th so that every month has the day.

A budget month takes the name of the calendar month that holds most of its days:

- From the 2nd to the 15th, the period starts in the month it is named after. With the 5th, **January** runs from 5 January to 4 February.
- From the 16th to the 28th, the period starts in the month before. With the 28th, **February** runs from 28 January to 27 February.

## Last day

Budget month M starts on the last day of month M−1 and ends the day before the last day of M. **March 2027** runs from 28 February to 30 March 2027; **March 2028** starts on 29 February, because 2028 is a leap year.

## Last working day

Budget month M starts on the last working day of month M−1: the last day of that month, moved back over Saturdays, Sundays and the public holidays of the chosen country. **June 2026** starts on Friday 29 May, because 31 May 2026 is a Sunday. In Germany, **April 2024** starts on 28 March, because 29 March 2024 is Good Friday.

Public holidays come from the [`date-holidays`](https://github.com/commenthol/date-holidays) package; only holidays it marks as `public` count. A country it does not know skips weekends only. Periods under this rule differ in length by a few days, the way paydays do.

In every rule, a salary paid on the day a period starts counts in that period, the month it pays for, together with that month's rent and groceries.

## What follows the start rule

- The **Transactions** page: the period navigator steps through budget months. **1M** is one budget month, **3M** three, and **1Y** the twelve budget months named after the months of that year. Unless the rule is day 1, the navigator shows the dates the period covers. **Monthly avg.** and **Monthly median** take one value per budget month.
- Home and dashboard widgets that speak of this month: **Spent this month**, **Income this month**, **Saved this month**, **Available to spend** and its end date, **Budgets** and its days left, **Top categories this month**, and the months of **Income vs spending**.
- The months the **Recent transactions** widget reaches back.

## What stays on calendar months

- The **Recurring** page and its monthly charts.
- The **Net worth** history.
- **Spending by week**, which counts weeks.
- The groups of the transaction list.
- The assistant, which asks for exact dates.

## When a change applies

Saving a new rule in **Settings** refetches the budget figures, so open pages show the new periods without a reload. Stored transactions do not change: each request groups them again with the current rule.

## Related

- [First run and the operator](first-run-and-operator.md)
- [How account types change the totals](account-types.md)
