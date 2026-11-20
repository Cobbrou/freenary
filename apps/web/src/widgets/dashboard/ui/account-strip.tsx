import { Skeleton } from "@freenary/ui/components/skeleton";
import { RiAddLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";

import { AccountBalance, accountName } from "@/entities/account";
import type { PortfolioAccount } from "@/entities/account";
import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";

import { useOverview } from "../model/queries";
import { WidgetError } from "./widget-card";

const SKELETON_TILES = 3;

const TILE_CLASS =
  "bg-surface-1 shadow-surface-1 hover:bg-surface-2 focus-visible:ring-ring/50 flex w-40 shrink-0 snap-start flex-col gap-3 rounded-xl border border-transparent p-3 transition-colors duration-100 outline-none focus-visible:ring-[3px]";

const AccountTile = ({ account }: { account: PortfolioAccount }) => (
  <li className="flex">
    <Link
      className={TILE_CLASS}
      params={{ accountId: account.id }}
      to="/accounts/$accountId"
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">
          {accountName(account)}
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {account.institutionName}
        </span>
      </span>
      <AccountBalance
        account={account}
        className="mt-auto text-base font-semibold"
      />
    </Link>
  </li>
);

const ManageBanksTile = () => (
  <li className="flex">
    <Link
      className={`${TILE_CLASS} text-muted-foreground items-start justify-between`}
      search={{ section: "connections" }}
      to="/settings"
    >
      <RiAddLine aria-hidden="true" className="size-5" />
      <span className="flex flex-col">
        <span className="text-foreground text-sm font-medium">
          {m.home_add_account()}
        </span>
        <span className="text-xs">{m.home_add_account_description()}</span>
      </span>
    </Link>
  </li>
);

export const AccountStrip = () => {
  const query = useOverview();
  const netWorth = query.data?.netWorth.netWorthMinor;

  return (
    <section
      aria-labelledby="home-accounts-title"
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 className="text-sm font-medium" id="home-accounts-title">
          {m.home_accounts_title()}
        </h2>
        {query.data && netWorth !== null && netWorth !== undefined ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {m.home_accounts_total({
              amount: formatCurrency(netWorth, query.data.currency),
            })}
          </span>
        ) : null}
      </div>
      {query.isPending ? (
        <div aria-busy="true" className="flex gap-3 overflow-hidden">
          <output className="sr-only">{m.home_accounts_loading()}</output>
          {Array.from({ length: SKELETON_TILES }, (_, index) => (
            <Skeleton
              aria-hidden="true"
              className="h-24 w-40 shrink-0 rounded-xl"
              key={index}
            />
          ))}
        </div>
      ) : null}
      {query.isError ? (
        <WidgetError
          isRetrying={query.isRetrying}
          message={m.home_accounts_error()}
          onRetry={query.handleRetry}
        />
      ) : null}
      {query.data ? (
        <ul className="-mx-4 flex snap-x scroll-px-4 [scrollbar-width:thin] gap-3 overflow-x-auto overscroll-x-contain px-4 pt-0.5 pb-2">
          {query.data.accounts.map((account) => (
            <AccountTile account={account} key={account.id} />
          ))}
          <ManageBanksTile />
        </ul>
      ) : null}
    </section>
  );
};
