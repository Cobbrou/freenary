import { Skeleton } from "@freenary/ui/components/skeleton";
import { Link } from "@tanstack/react-router";

import { AccountBalance, accountName } from "@/entities/account";
import { m } from "@/paraglide/messages.js";

import { useOverview } from "../model/queries";
import {
  WidgetCard,
  WidgetEmpty,
  WidgetError,
  WidgetLoading,
} from "./widget-card";

const SKELETON_ROWS = 3;

export const AccountsWidget = ({ title }: { title?: string }) => {
  const query = useOverview();

  return (
    <WidgetCard headingLevel="h3" title={title ?? m.home_accounts_title()}>
      {query.isPending ? (
        <WidgetLoading label={m.home_accounts_loading()}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton className="h-10" key={index} />
          ))}
        </WidgetLoading>
      ) : null}
      {query.isError ? (
        <WidgetError
          isRetrying={query.isRetrying}
          message={m.home_accounts_error()}
          onRetry={query.handleRetry}
        />
      ) : null}
      {query.data?.accounts.length === 0 ? (
        <WidgetEmpty>{m.widget_accounts_empty()}</WidgetEmpty>
      ) : null}
      {query.data && query.data.accounts.length > 0 ? (
        <ul className="flex flex-col">
          {query.data.accounts.map((account) => (
            <li key={account.id}>
              <Link
                className="hover:bg-muted focus-visible:ring-ring/50 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 outline-none focus-visible:ring-[3px]"
                params={{ accountId: account.id }}
                to="/accounts/$accountId"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {accountName(account)}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {account.institutionName}
                  </span>
                </span>
                <AccountBalance
                  account={account}
                  className="text-sm font-medium"
                  layout="inline"
                  reportingCurrency={query.data?.currency ?? "EUR"}
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </WidgetCard>
  );
};
