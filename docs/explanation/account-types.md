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

An account you exclude counts in none of these figures, whatever its type, as [Accounts you exclude](#accounts-you-exclude) explains.

### Current accounts and Available to spend

These add up the balances of the `CHECKING` accounts and take off what `CARD` accounts have spent, converted into your reporting currency. With no current account that reports a balance, they show nothing. The same balance starts the balance forecast on **Recurring**.

### Net worth

**Net worth** adds every account that reports a balance, converted into your reporting currency, then takes off the debts. An account holding several currencies counts all of them. A `LOAN` or `CARD` balance is always a debt, whether the bank reports it as a negative balance or as the amount left to repay. Any other account with a negative balance, such as an overdrawn current account, counts as a debt too. The chart of net worth at the end of each month follows the same rules.

### Spending, income and cash flow

The spending breakdown, budget against actual, fixed against variable, weekly spending, the Sankey diagram, the cash-flow chart, recurring expenses and monthly income read only the transactions of `CHECKING`, `CARD` and `UNKNOWN` accounts. Interest paid into a Livret A, an order bought inside a PEA or a repayment line on a loan account counts in none of them.

These figures also leave out internal transfers and every transaction under **Transfer between my accounts**, except a move from a current account into a savings, investment or retirement account, described below. Moving money between two current accounts, or from a current account to a card, is neither income nor spending. They leave out the transactions you excluded too, as [below](#transactions-you-exclude) explains, and every transaction of an [account you exclude](#accounts-you-exclude).

A transaction in another currency is converted into your reporting currency. An exchange between two of your own currencies counts only what it cost. [How currencies are converted](currencies.md) explains the rates and the rules.

The transaction list shows the transactions of every account and every currency, internal transfers and excluded transactions included. Its totals count every account, leave out every internal transfer, every transaction under **Transfer between my accounts** and every excluded transaction, and convert every currency into your reporting currency. The total under each day or week follows the same rule, in the currency of each transaction.

### Transactions you exclude

Two controls in the transaction details leave a transaction out of every figure above, whatever its account and its category:

- The **Exclude from analytics** switch leaves out that transaction alone. Turned off, it counts again.
- **Exclude this merchant**, in the **More actions** menu (⋮), leaves out every transaction with its merchant key, the ones already imported and the ones later syncs bring. It shows only when the transaction has a merchant key. While the merchant is excluded, the switch stays on and cannot be changed; **Count this merchant again**, in the same menu, brings the merchant back. Freenary stores the merchant in the `excluded_merchant` table.

A transaction under **Transfer between my accounts** shows neither control: it never counts. An excluded transaction keeps its category and still goes through categorisation. The transaction list shows it with its amount struck through and the word **Excluded**. Each control undoes only its own exclusion: a transaction excluded alone stays excluded when its merchant is counted again, and a transaction counted again alone stays excluded while its merchant or its account is.

Once a transaction or its merchant is excluded, a **Reason (optional)** field shows under the switch in the transaction details. **Save** stores the text you typed, up to 200 characters; an empty field stores no reason. Freenary keeps the reason of a transaction in the `exclusionReason` column of `transaction`, and the reason of a merchant in the `reason` column of `excluded_merchant`. The transaction list then shows **Excluded:** followed by the reason. Counting the transaction or the merchant again deletes its reason.

### Accounts you exclude

The **Exclude from analytics** switch on the page of a bank account leaves that account out of every figure on this page: **Current accounts**, **Available to spend**, **Net worth** and its chart, the holdings, and every spending, income and cash-flow figure. Use it for an account you see through your bank but do not want in your own figures, such as a joint account.

- The transactions of the account stay in the transaction list, struck through, and the transaction details say **Excluded with every transaction from this account.** Their **Exclude from analytics** switch stays on and cannot be changed there.
- The transactions later syncs bring into the account are excluded too.
- A move between the account and your other accounts is no longer an internal transfer. Money you move into it counts as spending from the account it left, and money it sends you counts as income. Freenary also forgets two kinds of owner names, so a later transfer to one of them counts as spending too: the names it learned from moves with the account, unless a move between two accounts you still count also shows them, and the holder names your bank reported for the account at its last sync, unless an account you still count reports them too. Syncs keep the holder names of each account in the `holderNameKeys` column of `bank_account`, and remember as yours only those of the accounts you count. An account last synced before Freenary kept these names has none to forget until its next sync. The names you marked as yours stay yours. Each time you turn the switch on or off, Freenary matches the internal transfers again in the background, and categorises the moves it releases. When a sync or a categorisation is already running, it does so once that run finishes; until then the transfers keep their previous state.
- A **Reason (optional)** field shows under the switch while the account is excluded. Its reason shows on each of its transactions. Freenary stores the exclusion in the `excluded` and `exclusionReason` columns of `bank_account`.
- The account stays on **Home**, marked **Excluded** after its bank, and its own page says **Excluded from analytics** under its name.
- Turned off, the switch deletes the reason, and every transaction of the account counts again, except the ones you excluded alone or with their merchant.

## Transfers between your own accounts

[How transactions get categories](categorisation.md#internal-transfers-come-first) explains how Freenary finds the transfers between your own accounts, linked to Freenary or not. The account types change two things:

- A `LOAN` account takes no part in internal transfers. A loan repayment from a current account is categorised like any other payment.
- When money leaves a current account for a linked savings, investment or retirement account, the current-account leg gets a category from the account it went to: `savings` for the savings accounts and `LIFE_INSURANCE`, `securities` for `PEA`, `BROKERAGE`, `CROWDLENDING` and `REAL_ESTATE`, and `retirement` for `RETIREMENT` and `EMPLOYEE_SAVINGS`. These categories belong to the **Savings & investment** group, so the move shows there rather than as spending.

## Related

- [How transactions get categories](categorisation.md)
- [Architecture](architecture.md)
