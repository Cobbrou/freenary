import type { Converter } from "../fx/converter";
import type { ProviderAccountType } from "../providers/types";
import type { AssetClass } from "./account-types";
import {
  ASSET_CLASSES,
  accountTypeRule,
  signedBalanceOf,
} from "./account-types";
import { accountsSummary, balancesOf } from "./accounts-summary";
import type { HeldBalance } from "./accounts-summary";

export interface ValuedAccount {
  balanceAt: Date | null;
  balanceMinor: number | null;
  balances?: readonly HeldBalance[];
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
  unconvertedAccountCount: number;
}

export interface CurrentAccounts {
  balanceMinor: number | null;
  balancesAt: Date | null;
  currency: string;
  unconvertedBalanceCount: number;
}

const laterOf = (current: Date | null, candidate: Date | null) => {
  if (candidate === null) {
    return current;
  }

  return current === null || candidate > current ? candidate : current;
};

export const currentAccountsOf = (
  accounts: ValuedAccount[],
  converter: Converter,
  asOf: Date = new Date()
): CurrentAccounts => {
  const { availableBalanceMinor, currency, unconvertedBalanceCount } =
    accountsSummary(accounts, converter, asOf);

  let balancesAt: Date | null = null;

  for (const account of accounts) {
    if (accountTypeRule(account.type).countsInAvailableBalance) {
      for (const held of balancesOf(account)) {
        if (
          converter.convert(held.balanceMinor, held.currency, asOf) !== null
        ) {
          balancesAt = laterOf(balancesAt, held.balanceAt ?? account.balanceAt);
        }
      }
    }
  }

  return {
    balanceMinor: availableBalanceMinor,
    balancesAt,
    currency,
    unconvertedBalanceCount,
  };
};

const convertedBalanceOf = (
  account: ValuedAccount,
  converter: Converter,
  asOf: Date
): number | null => {
  const held = balancesOf(account);

  if (held.length === 0) {
    return null;
  }

  let total = 0;

  for (const balance of held) {
    const converted = converter.convert(
      signedBalanceOf(account.type, balance.balanceMinor),
      balance.currency,
      asOf
    );

    if (converted === null) {
      return null;
    }

    total += converted;
  }

  return total;
};

export const netWorthOf = (
  accounts: ValuedAccount[],
  converter: Converter,
  asOf: Date = new Date()
): NetWorth => {
  const byClass = new Map<AssetClass, number>();
  let assetsMinor = 0;
  let liabilitiesMinor = 0;
  let excludedAccountCount = 0;
  let unconvertedAccountCount = 0;
  let valuedAccountCount = 0;
  let balancesAt: Date | null = null;

  for (const account of accounts) {
    const held = balancesOf(account);
    const balanceMinor = convertedBalanceOf(account, converter, asOf);

    if (balanceMinor === null) {
      excludedAccountCount += 1;
      unconvertedAccountCount += held.length > 0 ? 1 : 0;

      continue;
    }

    valuedAccountCount += 1;

    for (const balance of held) {
      balancesAt = laterOf(balancesAt, balance.balanceAt ?? account.balanceAt);
    }

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
    unconvertedAccountCount,
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
  unconvertedHoldingCount: number;
  unrealisedGainMinor: number | null;
  valuationMinor: number;
}

export const TOP_HOLDINGS_SHOWN = 3;

export const holdingsSummaryOf = (
  holdings: ValuedHolding[],
  converter: Converter,
  asOf: Date = new Date()
): HoldingsSummary => {
  const inCurrency = holdings.flatMap((holding) => {
    const valuationMinor = converter.convert(
      holding.valuationMinor,
      holding.currency,
      asOf
    );

    if (valuationMinor === null) {
      return [];
    }

    const { unrealisedGainMinor } = holding;

    return [
      {
        ...holding,
        unrealisedGainMinor:
          unrealisedGainMinor === null
            ? null
            : converter.convert(unrealisedGainMinor, holding.currency, asOf),
        valuationMinor,
      },
    ];
  });

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
    unconvertedHoldingCount: holdings.length - inCurrency.length,
    unrealisedGainMinor: reportsGain ? gainMinor : null,
    valuationMinor,
  };
};
