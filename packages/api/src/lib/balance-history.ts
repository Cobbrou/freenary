export interface HistoryAccount {
  balanceMinor: number | null;
  currency: string | null;
  id: string;
}

export interface HistoryTransaction {
  accountId: string;
  amount: number;
  date: Date;
}

export interface BalancePoint {
  balanceMinor: number;
  date: string;
}

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

export const monthEndsBefore = (today: Date, months: number): Date[] =>
  Array.from(
    { length: months },
    (_, index) =>
      new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth() - months + index + 1,
          0,
          23,
          59,
          59,
          999
        )
      )
  );

export const balanceHistory = (
  accounts: readonly HistoryAccount[],
  transactions: readonly HistoryTransaction[],
  currency: string,
  today: Date,
  months: number
): BalancePoint[] | null => {
  const valued = new Map<string, number>();

  for (const account of accounts) {
    if (account.balanceMinor !== null && account.currency === currency) {
      valued.set(account.id, account.balanceMinor);
    }
  }

  if (valued.size === 0) {
    return null;
  }

  const balanceNow = [...valued.values()].reduce(
    (sum, balance) => sum + balance,
    0
  );

  const counted = transactions.filter((transaction) =>
    valued.has(transaction.accountId)
  );

  const history = monthEndsBefore(today, months).map((monthEnd) => ({
    balanceMinor:
      balanceNow -
      counted
        .filter((transaction) => transaction.date > monthEnd)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    date: isoDay(monthEnd),
  }));

  return [...history, { balanceMinor: balanceNow, date: isoDay(today) }];
};
