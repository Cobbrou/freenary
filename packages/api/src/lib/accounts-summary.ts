const FALLBACK_CURRENCY = "EUR";

export interface AccountsSummary {
  availableBalanceMinor: number | null;
  currency: string;
}

const mostFrequentCurrency = (currencyCounts: Map<string, number>): string => {
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

export const accountsSummary = (
  accounts: {
    balanceMinor: number | null;
    currency: string | null;
    type: string;
  }[]
): AccountsSummary => {
  const checking = accounts.filter((account) => account.type === "CHECKING");
  const currencyCounts = new Map<string, number>();

  for (const account of checking) {
    if (account.currency) {
      currencyCounts.set(
        account.currency,
        (currencyCounts.get(account.currency) ?? 0) + 1
      );
    }
  }

  const currency = mostFrequentCurrency(currencyCounts);
  let balance = 0;
  let valued = false;

  for (const account of checking) {
    if (account.currency === currency && account.balanceMinor !== null) {
      balance += account.balanceMinor;
      valued = true;
    }
  }

  return { availableBalanceMinor: valued ? balance : null, currency };
};
