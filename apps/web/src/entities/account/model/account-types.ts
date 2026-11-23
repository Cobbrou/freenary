import type { AppRouter } from "@freenary/api/routers/index";
import type { InferRouterOutputs } from "@orpc/server";

import { m } from "@/paraglide/messages.js";

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
