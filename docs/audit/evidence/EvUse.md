I checked every signed-in screen against the routers, the sync code and both message catalogs. Catalog parity is clean, but I found several behaviour gaps the docs either miss or get wrong. I edited nothing; this is a report only.

## Message catalogs

- All 845 message keys used in `apps/web/src` exist in both `en.json` and `fr.json`, and every catalog key is used in the code. The scanner's only "missing" hit was `m.id` in a test file, a false positive.
- **English shown to French readers:** the server sends a fixed label `"Other Income"` (`packages/api/src/routers/budget.ts:123`), and the Cash Flow chart shows it as-is (`cash-flow-sankey.ts:154`).
- **Untranslated server errors in toasts:** these use the raw `error.message`:
  - creating or editing a custom category, e.g. `"A category with that name already exists"` and the nesting refusals (`use-custom-category-form.ts:70`)
  - disconnecting a bank (`use-bank-connections.ts`)
  - saving the budget profile, which only uses the translated fallback when the message is empty (`use-budget-profile-editor.ts:180`).
- **Same English word, two French words:** "Money left" is `budget_money_left` = "Reste à vivre" on the budget chart, but `settings_budget_money_left` = "Reste à répartir" in settings.

## Screens and what backs them

- **Navigation** (`nav-items.ts`): `Home`, `Budget` (with `Transactions` and `Recurring` under it) and `Settings` work. `Portfolio`, `Analysis` and `Goals` are marked `Planned` and show "{page} is planned". `/budget` redirects to `/budget/transactions`.
- **Route gate:** a guest goes to `/login`, an instance that is not set up goes to `/setup`, and a user who has not finished onboarding goes to `/onboarding`.
- **Onboarding:** two steps, "Tax residency" then "Bank connection". You must pick 1 to 10 countries. "Skip for now" finishes onboarding without a bank. Your choices are saved in the browser until you finish.
  - **There is no screen to change tax residency afterwards.** The bank list always uses it.
- **First steps checklist** (sidebar): `Connect your bank`, `Set up your budget`, `Protect your account`.
  - "Protect your account" counts as done with two-factor or at least one passkey.
  - The panel shows while any step is open. When the last step is done, it holds for 1.4 s, then closes. It comes back if a step becomes undone, e.g. you disconnect your only bank.
- **Settings sections:** `appearance` (the default), `connections`, `budget`, `security`.
  - Theme is stored by `next-themes` in the browser's localStorage.
  - Language comes from the `PARAGLIDE_LOCALE` cookie, then the browser's preferred language, then English.
- **Budget plan:** at most 200 lines, each label up to 60 characters, amounts are whole cents of 0 or more. Saving replaces every line at once.
- **Custom categories:**
  - Names are 1 to 40 characters and must be unique ignoring case.
  - Nesting goes one level deep.
  - Deleting one moves its lines to the fallback category for its group.
  - Custom categories can only be used on budget lines; transactions accept only built-in categories (`budget.ts` `updateTransactionCategory`).
- **Changing a transaction's category:** the choice is saved for that merchant, applies to other transactions from the same merchant that were not fixed by hand, and applies to future ones.
  - **Reset also undoes the choice for the other transactions from that merchant** and deletes the saved merchant choice. The docs only say reset "puts back the category Freenary chose".
- **Account security:** sessions last 7 days.
  - Adding or deleting a passkey, and linking or unlinking a provider, need a sign-in less than 15 minutes old. Otherwise the user sees "Sign in again before changing how your account is accessed…". Renaming a passkey is not on that list.
  - "Remember this device" lasts 30 days.
  - One-time email codes: 6 digits, valid 10 minutes, 3 tries.
  - Passwords: 12 to 128 characters.
  - **Settings has no way to change or set a password.** The `Password` row only shows the date it was added; the only route is `Forgot password?`, which needs email configured.

## Sync

- **What starts a sync:**
  - Opening Budget runs a quiet sync once per page load, only if accounts exist and no sync is running. It reads from the last sync date. Failures show a toast; success shows nothing.
  - `Sync transactions` re-reads 90 days for every connection, then clears the automatic categories and sorts again. Hand-picked categories are kept.
  - The re-sync button on a bank's row does the same for that one connection.
- **No scheduled or server-side sync exists.**
- **One sync at a time per user.** A run left silent for 5 minutes counts as abandoned and a new one can start. The app checks progress every 1.5 s and refreshes the data every 100 imported transactions.
- **Bug: a bank row can say "{institution} re-synced" when nothing ran.** If another sync is already running, the server returns `started:false, success:true`, and the row's re-sync button still shows the success toast (`use-bank-connections.ts`).
- **Bug: transactions can be skipped.** If fetching one account fails, the connection's last-sync date still moves forward (`bank-sync.ts`, where `importAccountsInSeries` catches the error before `lastSyncedAt` is updated).
  - For Enable Banking, which does not re-fetch the account list, this happens every time an account fails.
  - The next quiet sync starts from the new date, so the failed days are skipped until a full 90-day re-sync.
  - It also contradicts the docs' claim that the `Synced` date "stops moving" (`use/bank-connections.mdx:80`).
- **"Reconnect to resume importing" can never appear.** It needs a connection status other than `ACTIVE`, but nothing ever sets `EXPIRED` or `ERROR`.

## Internal transfers

- **How they are detected:** after every sync, the same amount going out of one account and into another, in the same currency, within 24 hours. The user needs at least 2 accounts, and hand-fixed transactions are ignored.
- **Where they are left out:**
  - automatic categorisation (so they show as "Other")
  - clearing categories on a re-sync
  - Recurring detection
  - the Recurring income figure.
- **Where they are still counted:**
  - the transaction list and its totals
  - Cash Flow
  - Spending Breakdown
  - Budget vs. actual
  - Fixed vs. variable.

  This matches `use/budget.mdx:80`.

## Currency

- Each transaction row and its details show the transaction's own currency.
- On Transactions, the tab totals, figures, charts, amount filters and budget-plan amounts are all formatted as EUR (`transaction-list.tsx:112-116`, and `formatCurrency` defaults to EUR).
- Recurring uses the currency most of your accounts use (EUR if none, ties go to the alphabetically first code), and each row keeps its own currency.
- Amounts are never converted between currencies.

## Rate limits users can hit

| Action | Limit | What the user sees |
| --- | --- | --- |
| Email sign-in, social sign-in | 10 / 60 s | `auth_error_rate_limited` "Too many attempts. Wait a moment and try again." |
| Sign-up | 5 / 300 s | same |
| Authenticator code | 10 / 300 s | same |
| Recovery code | 5 / 300 s | same |
| Passkey sign-in steps | 20 / 60 s | same |
| Any other auth path | 100 / 60 s | same, in login and security settings |
| Email address check | 20 / 60 s | `auth_email_check_blocked_rate_limited` |
| Assistant questions and saved answers | 30 / 300 s, per user, shared by both model paths | `assistant_error_rate_limited` "Too many questions in a row. Wait a moment and try again." |

- These limits come from `packages/auth/src/policy.ts`.
- **A question over 8,000 characters is not explained.** It is refused as `bad_request`, which shows the generic "The assistant could not answer. Try again."
- An answer stops after 6 steps.

## Recurring rules (`recurrence.ts`)

- **Time span:** the last 12 months, out-going payments only, grouped by merchant.
- **How often a payment must repeat:**
  - weekly: every 5 to 9 days, at least 4 times
  - monthly: every 25 to 35 days, at least 3 times
  - quarterly: every 80 to 100 days, at least 2 times
  - yearly: every 340 to 395 days, at least 2 times
  - irregular: every 10 to 400 days, at least 4 times.
- **Labels:**
  - "Commitments" needs regular timing (variation within 20%) and a steady amount (within 25%).
  - "Confirmed" also needs the amount within 5% and at least 3 payments.
  - Everything else is "Spending patterns".

## What to fix first

1. Stop moving the last-sync date when an account fails, or correct `use/bank-connections.mdx:80`.
2. Don't show the per-bank "re-synced" toast when `started` is false.
3. Translate `"Other Income"`, and map the custom-category, disconnect and budget-save errors to message keys.
4. Either delete the unreachable "reconnect" row state or make the sync set `EXPIRED`.
5. Document that reset also reverts the other transactions from that merchant, and that Settings has no password change.
