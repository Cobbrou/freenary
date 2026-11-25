import type { AppRouter } from "@freenary/api/routers/index";
import type { InferRouterOutputs } from "@orpc/server";

import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";

export type PortfolioAccount =
  InferRouterOutputs<AppRouter>["portfolio"]["getOverview"]["accounts"][number];

type AccountType = PortfolioAccount["type"];

export const ACCOUNT_TYPE_LABELS = {
  BROKERAGE: m.home_account_type_brokerage,
  CARD: m.home_account_type_card,
  CEL: m.home_account_type_cel,
  CHECKING: m.home_account_type_checking,
  CROWDLENDING: m.home_account_type_crowdlending,
  EMPLOYEE_SAVINGS: m.home_account_type_employee_savings,
  LDDS: m.home_account_type_ldds,
  LEP: m.home_account_type_lep,
  LIFE_INSURANCE: m.home_account_type_life_insurance,
  LIVRET_A: m.home_account_type_livret_a,
  LOAN: m.home_account_type_loan,
  PEA: m.home_account_type_pea,
  PEL: m.home_account_type_pel,
  REAL_ESTATE: m.home_account_type_real_estate,
  RETIREMENT: m.home_account_type_retirement,
  SAVINGS: m.home_account_type_savings,
  TERM_DEPOSIT: m.home_account_type_term_deposit,
  UNKNOWN: m.home_account_type_unknown,
} satisfies Record<AccountType, () => string>;

export const accountName = (account: PortfolioAccount): string =>
  account.name ?? ACCOUNT_TYPE_LABELS[account.type]();

export interface HeldBalance {
  balanceMinor: number;
  convertedBalanceMinor: number | null;
  currency: string;
}

export const heldBalancesOf = (account: PortfolioAccount): HeldBalance[] => {
  if (account.balances.length > 0) {
    return account.balances;
  }

  return account.balanceMinor === null || account.currency === null
    ? []
    : [
        {
          balanceMinor: account.balanceMinor,
          convertedBalanceMinor: null,
          currency: account.currency,
        },
      ];
};

export type AccountHeadline =
  | { kind: "none" }
  | { amount: string; kind: "single" }
  | {
      amount: string;
      currencyCount: number;
      isEstimate: boolean;
      kind: "several";
    };

export const accountHeadlineOf = (
  account: PortfolioAccount,
  reportingCurrency: string
): AccountHeadline => {
  const held = heldBalancesOf(account);
  const [only] = held;

  if (!only) {
    return { kind: "none" };
  }

  if (held.length === 1) {
    return {
      amount: formatCurrency(only.balanceMinor, only.currency),
      kind: "single",
    };
  }

  let totalMinor = 0;
  let isComplete = true;

  for (const balance of held) {
    if (balance.convertedBalanceMinor === null) {
      isComplete = false;
    } else {
      totalMinor += balance.convertedBalanceMinor;
    }
  }

  return isComplete
    ? {
        amount: formatCurrency(totalMinor, reportingCurrency),
        currencyCount: held.length,
        isEstimate: held.some(
          (balance) => balance.currency !== reportingCurrency
        ),
        kind: "several",
      }
    : {
        amount: formatCurrency(only.balanceMinor, only.currency),
        currencyCount: held.length,
        isEstimate: false,
        kind: "several",
      };
};

export const formatAccountBalances = (
  account: PortfolioAccount,
  reportingCurrency: string
): string | null => {
  const headline = accountHeadlineOf(account, reportingCurrency);

  if (headline.kind === "none") {
    return null;
  }

  if (headline.kind === "single") {
    return headline.amount;
  }

  return m.account_balance_several({
    amount: headline.isEstimate ? `≈ ${headline.amount}` : headline.amount,
    count: headline.currencyCount,
  });
};
