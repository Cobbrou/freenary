import type { Converter } from "../fx/converter";
import { accountTypeRule, signedBalanceOf } from "./account-types";

const FALLBACK_CURRENCY = "EUR";

export interface HeldBalance {
  balanceAt: Date | null;
  balanceMinor: number;
  currency: string;
}

export interface BalancedAccount {
  balanceAt?: Date | null;
  balanceMinor: number | null;
  balances?: readonly HeldBalance[];
  currency: string | null;
  type: string;
}

export interface AccountsSummary {
  availableBalanceMinor: number | null;
  currency: string;
  unconvertedBalanceCount: number;
}

export const mostFrequentCurrency = (
  currencyCounts: Map<string, number>
): string => {
  let currency = FALLBACK_CURRENCY;
  let bestCount = 0;

  for (const [code, count] of currencyCounts) {
    const tieBrokenByCode = count === bestCount && code < currency;

    if (count > bestCount || tieBrokenByCode) {
      currency = code;
      bestCount = count;
    }
  }

  return currency;
};

const holdsMoney = (account: { type: string }) =>
  !accountTypeRule(account.type).isDebt;

const countCurrencies = (
  accounts: readonly { currency: string | null }[]
): Map<string, number> => {
  const counts = new Map<string, number>();

  for (const account of accounts) {
    if (account.currency) {
      counts.set(account.currency, (counts.get(account.currency) ?? 0) + 1);
    }
  }

  return counts;
};

export const detectedCurrencyOf = (
  accounts: readonly { currency: string | null; type: string }[]
): string => {
  const everyday = countCurrencies(
    accounts.filter(
      (account) =>
        accountTypeRule(account.type).countsInAvailableBalance &&
        holdsMoney(account)
    )
  );

  return mostFrequentCurrency(
    everyday.size > 0 ? everyday : countCurrencies(accounts)
  );
};

export const balancesOf = (
  account: BalancedAccount
): readonly HeldBalance[] => {
  if (account.balances && account.balances.length > 0) {
    return account.balances;
  }

  return account.currency !== null && account.balanceMinor !== null
    ? [
        {
          balanceAt: account.balanceAt ?? null,
          balanceMinor: account.balanceMinor,
          currency: account.currency,
        },
      ]
    : [];
};

export const accountsSummary = (
  accounts: readonly BalancedAccount[],
  converter: Converter,
  asOf: Date = new Date()
): AccountsSummary => {
  let balance = 0;
  let valued = false;
  let unconvertedBalanceCount = 0;

  for (const account of accounts) {
    if (!accountTypeRule(account.type).countsInAvailableBalance) {
      continue;
    }

    for (const held of balancesOf(account)) {
      const converted = converter.convert(
        signedBalanceOf(account.type, held.balanceMinor),
        held.currency,
        asOf
      );

      if (converted === null) {
        unconvertedBalanceCount += 1;
      } else {
        balance += converted;
        valued ||= holdsMoney(account);
      }
    }
  }

  return {
    availableBalanceMinor: valued ? balance : null,
    currency: converter.currency,
    unconvertedBalanceCount,
  };
};
