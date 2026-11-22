import { signedBalanceOf } from "./account-types";

export interface HistoryAccount {
  balanceMinor: number | null;
  currency: string | null;
  id: string;
  type: string;
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
  const ledgerSign = new Map<string, number>();
  let balanceNow = 0;

  for (const account of accounts) {
    if (account.balanceMinor !== null && account.currency === currency) {
      const signed = signedBalanceOf(account.type, account.balanceMinor);

      ledgerSign.set(account.id, signed === account.balanceMinor ? 1 : -1);
      balanceNow += signed;
    }
  }

  if (ledgerSign.size === 0) {
    return null;
  }

  const counted = transactions.flatMap((transaction) => {
    const sign = ledgerSign.get(transaction.accountId);

    return sign === undefined
      ? []
      : [{ amount: sign * transaction.amount, date: transaction.date }];
  });

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
