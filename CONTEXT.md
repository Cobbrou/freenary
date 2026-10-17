# Freenary — Project Context

Freenary is an open-source, AI-powered personal finance and wealth-management platform. It aggregates financial data from multiple providers (such as Powens or Enable Banking), unifies banking, investments, assets, liabilities and transactions into a common financial model, and uses that model to provide budgeting, portfolio analytics, planning, simulations, financial insights and intelligent assistance.

The ambition is a **user-controlled personal financial operating system**, not another isolated finance app. The progression at the heart of the project: connect the financial data → understand the present → analyze what can be improved → define where the user wants to go → simulate possible futures → help the user make informed decisions.

This document describes the product vision and domain vocabulary. Nothing in it asserts an implemented feature; it defines what the project is building toward.

## Product definition

- **What**: one open-source platform for managing, understanding and improving an individual's or household's finances.
- **How**: aggregation from banking APIs and other providers, manual asset management, normalized transactions and holdings, portfolio analytics, budgeting, financial planning, and an AI layer that reasons across all of it.
- **Why**: give users a clear view of their complete financial position and useful assistance for virtually any financial question — not just wealth visualization.

Freenary is broader than a portfolio tracker. A tracker answers "What are my investments worth?". Freenary also answers "Where is my money going?", "How much can I safely spend?", "Am I investing enough?", "Can I afford this purchase?", "When could I reach financial independence?" and similar questions.

## Application areas

Each area answers one question over the same underlying financial model:

| Area      | Question                                            |
| --------- | --------------------------------------------------- |
| Home      | Where am I financially right now?                   |
| Portfolio | What do I own, where is it held, and what do I owe? |
| Budget    | Where does my money come from and where does it go? |
| Analysis  | Is my financial setup healthy and efficient?        |
| Goals     | Where am I trying to get?                           |
| AI        | What does all of this mean, and what can I do?      |
| Invest    | How can I execute the decision? (future)            |

Areas are perspectives on one shared model — never independent mini-applications.

## Glossary

Terms defined here are canonical; do not drift to synonyms.

The shipped app and the docs word some of them differently: a **Connection** is a "bank connection", an **Account** below is a "bank account" there, "account" alone means the sign-in account, a **Recurring expense** is a "recurring payment", and a **Budget period** is a "period".

- **Financial model** — the single internal representation of a user's financial life that every area reads from.
- **Connection** — the external institution/provider link through which data is synchronized (e.g. a bank connected via Powens).
- **Account** — a container of holdings within a connection or created manually (bank account, brokerage account, life-insurance contract, crypto account). Hierarchy: Connection → Account → Holding / Transaction.
- **Asset** — anything contributing to wealth, synchronized or manual: accounts, real estate, private companies, precious metals, vehicles, collectibles, employee equity, loans made to others.
- **Holding** — an individual security inside an account, with units, cost basis, price and value.
- **Transaction** — a financial operation (purchase, sale, deposit, withdrawal, dividend, fee, transfer). One shared transaction layer feeds both Portfolio and Budget.
- **Liability** — debt attached to financed assets (mortgage, loan, credit-card balance). Net position = assets − liabilities.
- **Budget period** — configurable cycle for cash-flow analysis (monthly, quarterly, yearly, arbitrary range), not assumed to be the calendar month.
- **Recurring expense** — a repeating payment detected from transaction history (subscription, insurance, rent).
- **Goal** — a user-defined financial objective with target amount/date, linked assets and planned contributions; progress computed against contributions, expected returns and inflation. The emergency fund is a specialized goal expressed in months of essential expenses.
- **Provider adapter** — an interchangeable connector behind a provider abstraction layer (banking, brokerage, market data, FX, crypto, AI). Powens and Enable Banking are two banking adapters, neither a dependency of the project.
- **Investor profile** — user context not inferable from accounts (household, horizon, risk tolerance); part of the financial model, evolving over time.
- **Scope** — a financial perimeter: personal profile or household with per-item ownership attribution.

## Boundaries

- Providers are interchangeable connectors, never the core of the application.
- Read-only data aggregation is distinct from payment/investment execution; execution features would require their own permissions and security boundaries.
- Freenary distinguishes information, mathematical simulation and regulated financial advice; AI outputs expose assumptions and remain inspectable down to underlying transactions/holdings.
