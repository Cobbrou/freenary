import { Button } from "@freenary/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@freenary/ui/components/popover";
import { cn } from "@freenary/ui/lib/utils";
import { RiArrowDownSLine } from "@remixicon/react";

import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";
import { remixIcon } from "@/shared/lib/remix-icon";

import { accountHeadlineOf, heldBalancesOf } from "../model/account-types";
import type { PortfolioAccount } from "../model/account-types";

const estimated = (amount: string, isEstimate: boolean) =>
  isEstimate ? `≈ ${amount}` : amount;

const NoBalance = ({ className }: { className?: string }) => (
  <span className={cn("text-muted-foreground", className)}>
    <span aria-hidden="true">—</span>
    <span className="sr-only">{m.home_accounts_no_balance()}</span>
  </span>
);

export const AccountBalance = ({
  account,
  className,
  layout = "stacked",
  reportingCurrency,
}: {
  account: PortfolioAccount;
  className?: string;
  layout?: "inline" | "stacked";
  reportingCurrency: string;
}) => {
  const headline = accountHeadlineOf(account, reportingCurrency);

  if (headline.kind === "none") {
    return <NoBalance className={className} />;
  }

  if (headline.kind === "single") {
    return (
      <span className={cn("tabular-nums", className)}>{headline.amount}</span>
    );
  }

  return (
    <span
      className={cn(
        "flex",
        layout === "inline" ? "flex-col items-end" : "flex-col items-start",
        className
      )}
    >
      <span className="whitespace-nowrap tabular-nums">
        {estimated(headline.amount, headline.isEstimate)}
      </span>
      <span className="text-muted-foreground text-xs font-normal whitespace-nowrap">
        {m.account_currency_count({ count: headline.currencyCount })}
      </span>
    </span>
  );
};

export const AccountBalanceBreakdown = ({
  account,
  reportingCurrency,
}: {
  account: PortfolioAccount;
  reportingCurrency: string;
}) => {
  const held = heldBalancesOf(account);
  const headline = accountHeadlineOf(account, reportingCurrency);

  if (headline.kind === "none") {
    return (
      <NoBalance className="text-4xl leading-none font-semibold tracking-tight sm:text-5xl" />
    );
  }

  if (headline.kind === "single") {
    return (
      <span className="text-4xl leading-none font-semibold tracking-tight tabular-nums sm:text-5xl">
        {headline.amount}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <span className="text-4xl leading-none font-semibold tracking-tight tabular-nums sm:text-5xl">
        {estimated(headline.amount, headline.isEstimate)}
      </span>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              size="sm"
              trailingIcon={remixIcon(RiArrowDownSLine)}
              variant="tertiary"
            />
          }
        >
          {m.account_currency_count({ count: headline.currencyCount })}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 gap-2">
          <p className="text-muted-foreground px-1 text-xs">
            {m.account_balances_title()}
          </p>
          <ul className="flex flex-col">
            {held.map((balance) => (
              <li
                className="flex items-baseline justify-between gap-4 rounded-md px-1 py-1.5 text-sm"
                key={balance.currency}
              >
                <span className="font-medium">{balance.currency}</span>
                <span className="flex flex-col items-end">
                  <span className="font-medium tabular-nums">
                    {formatCurrency(balance.balanceMinor, balance.currency)}
                  </span>
                  {balance.currency === reportingCurrency ? null : (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {balance.convertedBalanceMinor === null
                        ? m.account_balances_no_rate()
                        : `≈ ${formatCurrency(balance.convertedBalanceMinor, reportingCurrency)}`}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {headline.isEstimate ? (
            <p className="text-muted-foreground px-1 text-xs">
              {m.account_balance_estimate()}
            </p>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
};
