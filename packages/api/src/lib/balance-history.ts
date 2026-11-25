import type { Converter } from "../fx/converter";
import { signedBalanceOf } from "./account-types";
import { balancesOf } from "./accounts-summary";
import type { HeldBalance } from "./accounts-summary";

export interface HistoryAccount {
  balanceMinor: number | null;
  balances?: readonly HeldBalance[];
  currency: string | null;
  id: string;
  type: string;
}

export interface HistoryTransaction {
  accountId: string;
  amount: number;
  currency: string;
  date: Date;
}

export interface BalancePoint {
  balanceMinor: number;
  date: string;
}

interface Ledger {
  balanceNow: number;
  currency: string;
  sign: number;
}

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

const ledgerKey = (accountId: string, currency: string) =>
  `${accountId}\u001F${currency}`;

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

const ledgersOf = (accounts: readonly HistoryAccount[]) => {
  const ledgers = new Map<string, Ledger>();

  for (const account of accounts) {
    for (const held of balancesOf(account)) {
      const signed = signedBalanceOf(account.type, held.balanceMinor);

      ledgers.set(ledgerKey(account.id, held.currency), {
        balanceNow: signed,
        currency: held.currency,
        sign: signed === held.balanceMinor ? 1 : -1,
      });
    }
  }

  return ledgers;
};

export const balanceHistory = (
  accounts: readonly HistoryAccount[],
  transactions: readonly HistoryTransaction[],
  converter: Converter,
  today: Date,
  months: number
): BalancePoint[] | null => {
  const ledgers = ledgersOf(accounts);

  if (ledgers.size === 0) {
    return null;
  }

  const pointAt = (date: Date, rewind: boolean): BalancePoint => {
    const byCurrency = new Map<string, number>();

    for (const ledger of ledgers.values()) {
      byCurrency.set(
        ledger.currency,
        (byCurrency.get(ledger.currency) ?? 0) + ledger.balanceNow
      );
    }

    for (const transaction of transactions) {
      const ledger = ledgers.get(
        ledgerKey(transaction.accountId, transaction.currency)
      );

      if (rewind && ledger && transaction.date > date) {
        byCurrency.set(
          ledger.currency,
          (byCurrency.get(ledger.currency) ?? 0) -
            ledger.sign * transaction.amount
        );
      }
    }

    let balanceMinor = 0;

    for (const [currency, nativeMinor] of byCurrency) {
      balanceMinor += converter.convert(nativeMinor, currency, date) ?? 0;
    }

    return { balanceMinor, date: isoDay(date) };
  };

  return [
    ...monthEndsBefore(today, months).map((monthEnd) =>
      pointAt(monthEnd, true)
    ),
    pointAt(today, false),
  ];
};

export const unconvertedHistoryCurrencies = (
  accounts: readonly HistoryAccount[],
  converter: Converter,
  today: Date
): string[] => {
  const currencies = new Set<string>();

  for (const ledger of ledgersOf(accounts).values()) {
    if (converter.convert(1, ledger.currency, today) === null) {
      currencies.add(ledger.currency);
    }
  }

  return [...currencies].toSorted();
};
