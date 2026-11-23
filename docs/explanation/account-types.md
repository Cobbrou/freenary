---
title: How account types change the totals
description: Which kinds of bank account Freenary counts in each balance, net worth and spending figure.
---

This page explains how the kind of each bank account, such as a current account, a Livret A, a PEA or a loan, decides which figures it counts in. The rules live in one table, `ACCOUNT_TYPE_RULES` in `packages/api/src/lib/account-types.ts`.

## The account types

Each account has one type, stored in the `type` column of `bank_account`.

| Type | Accounts it covers |
| --- | --- |
| `CHECKING` | Current accounts, joint accounts included |
| `CARD` | Deferred-debit cards, whose spending the current account pays once a month |
| `LIVRET_A` | Livret A and Livret Bleu |
| `LDDS` | Livret de développement durable et solidaire |
| `LEP` | Livret d'épargne populaire |
| `CEL` | Compte épargne logement |
| `PEL` | Plan épargne logement |
| `TERM_DEPOSIT` | Compte à terme |
| `SAVINGS` | Any other savings account, such as a compte sur livret |
| `PEA` | Plan d'épargne en actions, PEA-PME included |
| `BROKERAGE` | Compte-titres |
| `LIFE_INSURANCE` | Assurance vie and contrats de capitalisation |
| `RETIREMENT` | PER, PERP, PERCO, Madelin and article 83 contracts |
| `EMPLOYEE_SAVINGS` | PEE and profit-sharing (RSP) |
| `REAL_ESTATE` | Real estate held through the bank |
| `CROWDLENDING` | Crowdlending |
| `LOAN` | Loans and mortgages |
| `UNKNOWN` | An account whose type the bank does not report |

## Where the type comes from

- **Powens** reports a type for each account on every sync. `packages/api/src/providers/powens/map-account.ts` maps it, for example `livret_a` to `LIVRET_A`, `pea` to `PEA` and `market` to `BROKERAGE`.
- **Enable Banking** reports an ISO 20022 cash account type when the bank is connected. `CACC` and `CASH` become `CHECKING`, `CARD` becomes `CARD`, `LOAN` becomes `LOAN` and `SVGS` becomes `SAVINGS`. The type is read once, when the connection is made.

  > **TODO (unverified):** check that Enable Banking sends `cash_account_type` and `product` for the accounts of a French bank.

- When the provider gives only `SAVINGS` or `UNKNOWN`, Freenary reads the product and account names. A name such as `LIVRET A`, `LDDS`, `Livret d'Épargne Populaire`, `PEL`, `CEL`, `PEA-PME` or `Compte à terme` gives the matching type. Any other type the provider sends is kept as it is.

An account imported before these types existed keeps its old type until Powens reports it again on the next sync. An Enable Banking account keeps its old type until the bank is connected again.

## Which figure counts which account

| Type | **Current accounts** and **Available to spend** | **Net worth** | Spending, income and cash flow |
| --- | --- | --- | --- |
| `CHECKING` | Counted | Counted as cash | Counted |
| `CARD` | Counted, as money already spent | Counted as a debt | Counted |
| `LIVRET_A`, `LDDS`, `LEP`, `CEL`, `PEL`, `TERM_DEPOSIT`, `SAVINGS` | Left out | Counted as savings | Left out |
| `PEA`, `BROKERAGE`, `LIFE_INSURANCE`, `CROWDLENDING` | Left out | Counted as investments | Left out |
| `RETIREMENT`, `EMPLOYEE_SAVINGS` | Left out | Counted as retirement | Left out |
| `REAL_ESTATE` | Left out | Counted as property | Left out |
| `LOAN` | Left out | Counted as a debt | Left out |
| `UNKNOWN` | Left out | Counted as other | Counted |

### Current accounts and Available to spend

These add up the balances of the `CHECKING` accounts and take off what `CARD` accounts have spent, in the currency most of the current accounts use. With no current account that reports a balance, they show nothing. The same balance starts the balance forecast on **Recurring**.

### Net worth

**Net worth** adds every account that reports a balance in your currency, then takes off the debts. A `LOAN` or `CARD` balance is always a debt, whether the bank reports it as a negative balance or as the amount left to repay. Any other account with a negative balance, such as an overdrawn current account, counts as a debt too. The chart of net worth at the end of each month follows the same rules.

### Spending, income and cash flow

The spending breakdown, budget against actual, fixed against variable, weekly spending, the Sankey diagram, the cash-flow chart, recurring expenses and monthly income read only the transactions of `CHECKING`, `CARD` and `UNKNOWN` accounts. Interest paid into a Livret A, an order bought inside a PEA or a repayment line on a loan account counts in none of them.

These figures also leave out internal transfers, except a move from a current account into a savings, investment or retirement account, described below. Moving money between two current accounts, or from a current account to a card, is neither income nor spending.

The transaction list shows the transactions of every account, internal transfers included. Its totals count every account and leave every internal transfer out.

## Transfers between your own accounts

[How transactions get categories](categorisation.md#internal-transfers-come-first) explains how Freenary pairs the two legs of a transfer between your own accounts. The account types change two things:

- A `LOAN` account takes no part in the pairing. A loan repayment from a current account is categorised like any other payment.
- When money leaves a current account for a savings, investment or retirement account, the current-account leg gets a category from the account it went to: `savings` for the savings accounts and `LIFE_INSURANCE`, `securities` for `PEA`, `BROKERAGE`, `CROWDLENDING` and `REAL_ESTATE`, and `retirement` for `RETIREMENT` and `EMPLOYEE_SAVINGS`. These categories belong to the **Savings & investment** group, so the move shows there rather than as spending.

## Related

- [How transactions get categories](categorisation.md)
- [Architecture](architecture.md)
