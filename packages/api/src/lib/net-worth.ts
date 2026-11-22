import type { ProviderAccountType } from "../providers/types";
import type { AssetClass } from "./account-types";
import {
  ASSET_CLASSES,
  accountTypeRule,
  signedBalanceOf,
} from "./account-types";
import { accountsSummary } from "./accounts-summary";

export interface ValuedAccount {
  balanceAt: Date | null;
  balanceMinor: number | null;
  currency: string | null;
  type: ProviderAccountType;
}

export interface NetWorth {
  assetClasses: { amountMinor: number; assetClass: AssetClass }[];
  assetsMinor: number;
  balancesAt: Date | null;
  excludedAccountCount: number;
  liabilitiesMinor: number;
  netWorthMinor: number | null;
}

export interface CurrentAccounts {
  balanceMinor: number | null;
  balancesAt: Date | null;
  currency: string;
}

const laterOf = (current: Date | null, candidate: Date | null) => {
  if (candidate === null) {
    return current;
  }

  return current === null || candidate > current ? candidate : current;
};

export const currentAccountsOf = (
  accounts: ValuedAccount[]
): CurrentAccounts => {
  const { availableBalanceMinor, currency } = accountsSummary(accounts);
  let balancesAt: Date | null = null;

  for (const account of accounts) {
    const isCounted =
      accountTypeRule(account.type).countsInAvailableBalance &&
      account.currency === currency &&
      account.balanceMinor !== null;

    if (isCounted) {
      balancesAt = laterOf(balancesAt, account.balanceAt);
    }
  }

  return { balanceMinor: availableBalanceMinor, balancesAt, currency };
};

export const netWorthOf = (
  accounts: ValuedAccount[],
  currency: string
): NetWorth => {
  const byClass = new Map<AssetClass, number>();
  let assetsMinor = 0;
  let liabilitiesMinor = 0;
  let excludedAccountCount = 0;
  let valuedAccountCount = 0;
  let balancesAt: Date | null = null;

  for (const account of accounts) {
    if (account.balanceMinor === null || account.currency !== currency) {
      excludedAccountCount += 1;

      continue;
    }

    valuedAccountCount += 1;
    balancesAt = laterOf(balancesAt, account.balanceAt);

    const balanceMinor = signedBalanceOf(account.type, account.balanceMinor);
    const { assetClass } = accountTypeRule(account.type);

    if (balanceMinor < 0 || assetClass === null) {
      liabilitiesMinor += Math.abs(balanceMinor);

      continue;
    }

    assetsMinor += balanceMinor;
    byClass.set(assetClass, (byClass.get(assetClass) ?? 0) + balanceMinor);
  }

  return {
    assetClasses: ASSET_CLASSES.flatMap((assetClass) => {
      const amountMinor = byClass.get(assetClass) ?? 0;

      return amountMinor > 0 ? [{ amountMinor, assetClass }] : [];
    }),
    assetsMinor,
    balancesAt,
    excludedAccountCount,
    liabilitiesMinor,
    netWorthMinor:
      valuedAccountCount > 0 ? assetsMinor - liabilitiesMinor : null,
  };
};

export interface ValuedHolding {
  currency: string;
  id: string;
  label: string;
  unrealisedGainMinor: number | null;
  valuationMinor: number;
}

export interface HoldingsSummary {
  costBasisMinor: number | null;
  holdingCount: number;
  topHoldings: Omit<ValuedHolding, "currency">[];
  unrealisedGainMinor: number | null;
  valuationMinor: number;
}

export const TOP_HOLDINGS_SHOWN = 3;

export const holdingsSummaryOf = (
  holdings: ValuedHolding[],
  currency: string
): HoldingsSummary => {
  const inCurrency = holdings.filter(
    (holding) => holding.currency === currency
  );

  let valuationMinor = 0;
  let gainMinor = 0;
  let valuationWithGainMinor = 0;
  let reportsGain = false;

  for (const holding of inCurrency) {
    valuationMinor += holding.valuationMinor;

    if (holding.unrealisedGainMinor !== null) {
      reportsGain = true;
      gainMinor += holding.unrealisedGainMinor;
      valuationWithGainMinor += holding.valuationMinor;
    }
  }

  return {
    costBasisMinor: reportsGain ? valuationWithGainMinor - gainMinor : null,
    holdingCount: inCurrency.length,
    topHoldings: inCurrency
      .toSorted((a, b) => b.valuationMinor - a.valuationMinor)
      .slice(0, TOP_HOLDINGS_SHOWN)
      .map(({ id, label, unrealisedGainMinor, valuationMinor: value }) => ({
        id,
        label,
        unrealisedGainMinor,
        valuationMinor: value,
      })),
    unrealisedGainMinor: reportsGain ? gainMinor : null,
    valuationMinor,
  };
};
