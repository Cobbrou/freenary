import { accountTypeRule, signedBalanceOf } from "./account-types";

const FALLBACK_CURRENCY = "EUR";

export interface AccountsSummary {
  availableBalanceMinor: number | null;
  currency: string;
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

export const accountsSummary = (
  accounts: {
    balanceMinor: number | null;
    currency: string | null;
    type: string;
  }[]
): AccountsSummary => {
  const available = accounts.filter(
    (account) => accountTypeRule(account.type).countsInAvailableBalance
  );

  const currencyCounts = new Map<string, number>();

  for (const account of available) {
    if (account.currency && holdsMoney(account)) {
      currencyCounts.set(
        account.currency,
        (currencyCounts.get(account.currency) ?? 0) + 1
      );
    }
  }

  const currency = mostFrequentCurrency(currencyCounts);
  let balance = 0;
  let valued = false;

  for (const account of available) {
    if (account.currency === currency && account.balanceMinor !== null) {
      balance += signedBalanceOf(account.type, account.balanceMinor);
      valued ||= holdsMoney(account);
    }
  }

  return { availableBalanceMinor: valued ? balance : null, currency };
};
