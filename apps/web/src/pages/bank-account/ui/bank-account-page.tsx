import { Button } from "@freenary/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@freenary/ui/components/empty";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { RiSettings3Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import {
  ACCOUNT_TYPE_LABELS,
  AccountBalance,
  accountHeadlineOf,
  accountName,
  heldBalancesOf,
} from "@/entities/account";
import type { PortfolioAccount } from "@/entities/account";
import { TransactionDetailDrawer } from "@/features/transaction-details";
import {
  TransactionList,
  useTransactionListQuery,
} from "@/features/transaction-list";
import type { AccountChoice } from "@/features/transaction-list";
import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";
import { formatCurrency } from "@/shared/lib/format-currency";
import { remixIcon } from "@/shared/lib/remix-icon";

import { useAccountTransactionsView } from "../model/use-account-transactions-view";

const ACCOUNT_EMPTY_DESCRIPTIONS = {
  incoming: m.bank_account_transactions_empty_incoming,
  outgoing: m.bank_account_transactions_empty_outgoing,
};

const AccountExclusionStatus = ({ account }: { account: PortfolioAccount }) => {
  if (!account.excluded) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-sm text-pretty break-words">
      {account.exclusionReason
        ? m.budget_transaction_excluded_reason({
            reason: account.exclusionReason,
          })
        : m.budget_transaction_excluded()}
    </p>
  );
};

const TOTAL_CLASS =
  "text-4xl leading-none font-semibold tracking-tight tabular-nums sm:text-5xl";

const AccountTotal = ({
  account,
  reportingCurrency,
}: {
  account: PortfolioAccount;
  reportingCurrency: string;
}) => {
  const held = heldBalancesOf(account);
  const headline = accountHeadlineOf(account, reportingCurrency);
  const isSeveral = headline.kind === "several";

  return (
    <section
      aria-labelledby="account-total-label"
      className="flex flex-col gap-2"
    >
      <h2 className="text-muted-foreground text-sm" id="account-total-label">
        {isSeveral
          ? m.bank_account_total_label()
          : m.bank_account_balance_label()}
        {!isSeveral && held.length === 1 ? (
          <span className="text-foreground font-medium">
            {" "}
            · {held[0]?.currency}
          </span>
        ) : null}
      </h2>
      {headline.kind === "several" ? (
        <p className={TOTAL_CLASS}>
          {headline.isEstimate ? `≈ ${headline.amount}` : headline.amount}
        </p>
      ) : (
        <AccountBalance
          account={account}
          className={TOTAL_CLASS}
          reportingCurrency={reportingCurrency}
        />
      )}
      {isSeveral ? (
        <ul className="flex flex-wrap gap-2 pt-1">
          {held.map((balance) => (
            <li
              className="border-border flex items-baseline gap-2 rounded-lg border px-2.5 py-1 text-sm"
              key={balance.currency}
            >
              <span className="font-medium">{balance.currency}</span>
              <span className="tabular-nums">
                {formatCurrency(balance.balanceMinor, balance.currency)}
              </span>
              {balance.currency === reportingCurrency ? null : (
                <span className="text-muted-foreground tabular-nums">
                  {balance.convertedBalanceMinor === null
                    ? m.account_balances_no_rate()
                    : `≈ ${formatCurrency(balance.convertedBalanceMinor, reportingCurrency)}`}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {headline.kind === "several" && headline.isEstimate ? (
        <p className="text-muted-foreground text-xs">
          {m.account_balance_estimate()}
        </p>
      ) : null}
    </section>
  );
};

const AccountHeader = ({
  account,
  reportingCurrency,
}: {
  account: PortfolioAccount;
  reportingCurrency: string;
}) => (
  <header className="flex flex-col gap-6 pt-2">
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-muted-foreground text-sm">
            {m.home_accounts_meta({
              institution: account.institutionName,
              type: ACCOUNT_TYPE_LABELS[account.type](),
            })}
          </p>
          <h1 className="text-xl font-semibold text-balance break-words">
            {accountName(account)}
          </h1>
        </div>
        <Button
          leadingIcon={remixIcon(RiSettings3Line)}
          render={
            <Link
              params={{ accountId: account.id }}
              to="/settings/bank-accounts/$accountId"
            />
          }
          size="compact"
          variant="tertiary"
        >
          {m.bank_account_settings_link()}
        </Button>
      </div>
      <AccountExclusionStatus account={account} />
    </div>
    <AccountTotal account={account} reportingCurrency={reportingCurrency} />
  </header>
);

const HeaderSkeleton = () => (
  <div aria-busy="true" className="flex flex-col gap-3 pt-2">
    <output className="sr-only">{m.bank_account_loading()}</output>
    <div aria-hidden="true" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-5 w-56" />
      </div>
      <Skeleton className="h-9 w-56 sm:h-12 sm:w-64" />
    </div>
  </div>
);

const NO_ACCOUNT_CHOICE: readonly AccountChoice[] = [];

const AccountTransactions = ({
  currency,
  list,
  view,
}: {
  currency: string;
  list: ReturnType<typeof useTransactionListQuery>;
  view: ReturnType<typeof useAccountTransactionsView>;
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { accountId, applyPatch, listInput } = view;

  const selected =
    list.transactions.find((transaction) => transaction.id === selectedId) ??
    null;

  return (
    <section
      aria-labelledby="account-transactions-title"
      className="flex flex-1 flex-col gap-2"
    >
      <h2 className="text-sm font-medium" id="account-transactions-title">
        {m.nav_budget_transactions()}
      </h2>
      {list.isStale ? (
        <output className="sr-only">{m.budget_view_updating()}</output>
      ) : null}
      <TransactionList
        {...list}
        accountId={accountId}
        accounts={NO_ACCOUNT_CHOICE}
        currency={currency}
        direction={listInput.direction}
        emptyDescriptions={ACCOUNT_EMPTY_DESCRIPTIONS}
        filters={listInput.filters}
        from={listInput.from}
        grouping="day"
        onDirectionChange={(dir) => applyPatch({ dir })}
        onFiltersChange={(filters) => applyPatch({ filters })}
        onSearchChange={(q) => applyPatch({ q })}
        onSearchReplace={(next) =>
          applyPatch({ filters: next.filters, q: next.search })
        }
        onSortChange={(sort) => applyPatch({ sort })}
        onTransactionClick={(transaction) => setSelectedId(transaction.id)}
        search={listInput.search}
        sort={listInput.sort}
        to={listInput.to}
      />
      <TransactionDetailDrawer
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
          }
        }}
        open={selectedId !== null}
        transaction={selected}
      />
    </section>
  );
};

const AccountMissing = () => (
  <Empty>
    <EmptyHeader>
      <EmptyTitle>{m.bank_account_missing_title()}</EmptyTitle>
      <EmptyDescription>
        {m.bank_account_missing_description()}
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <Button render={<Link to="/" />} variant="tertiary">
        {m.bank_account_missing_home()}
      </Button>
    </EmptyContent>
  </Empty>
);

export const BankAccountPage = () => {
  const view = useAccountTransactionsView();
  const list = useTransactionListQuery(view.listInput);
  const overview = useQuery(orpc.portfolio.getOverview.queryOptions());
  const account = overview.data?.accounts.find(
    (candidate) => candidate.id === view.accountId
  );

  if (overview.isPending) {
    return (
      <div className="flex flex-1 flex-col gap-8 p-4">
        <h1 className="sr-only">{m.nav_bank_account()}</h1>
        <HeaderSkeleton />
      </div>
    );
  }

  if (overview.isError && !overview.data) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h1 className="sr-only">{m.nav_bank_account()}</h1>
        <p className="text-muted-foreground text-sm">
          {m.home_accounts_error()}
        </p>
        <div>
          <Button
            loading={overview.isFetching}
            onClick={() => {
              void overview.refetch();
            }}
            size="compact"
            type="button"
            variant="tertiary"
          >
            {m.home_retry()}
          </Button>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <>
        <h1 className="sr-only">{m.nav_bank_account()}</h1>
        <AccountMissing />
      </>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-4">
      <AccountHeader
        account={account}
        reportingCurrency={overview.data.currency}
      />
      <AccountTransactions
        currency={overview.data.currency}
        key={account.id}
        list={list}
        view={view}
      />
    </div>
  );
};
