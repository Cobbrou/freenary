import { cn } from "@freenary/ui/lib/utils";

import { m } from "@/paraglide/messages.js";

import { accountHeadlineOf } from "../model/account-types";
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
