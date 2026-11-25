import prisma from "@freenary/db";

import { converterOf } from "../fx/converter";
import type { Converter } from "../fx/converter";
import { loadRateBook } from "../fx/rates";
import { detectedCurrencyOf } from "./accounts-summary";

export interface CurrencySetting {
  currency: string;
  detected: string;
  setting: string | null;
}

export const userCurrencySetting = async (
  userId: string
): Promise<CurrencySetting> => {
  const [user, accounts] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      select: { reportingCurrency: true },
      where: { id: userId },
    }),
    prisma.bankAccount.findMany({
      select: { currency: true, type: true },
      where: { connection: { userId } },
    }),
  ]);

  const detected = detectedCurrencyOf(accounts);

  return {
    currency: user.reportingCurrency ?? detected,
    detected,
    setting: user.reportingCurrency,
  };
};

export const userCurrency = async (userId: string): Promise<string> => {
  const { currency } = await userCurrencySetting(userId);

  return currency;
};

export const userHeldCurrencies = async (userId: string): Promise<string[]> => {
  const owned = { account: { connection: { userId } } };
  const [transactions, balances, holdings] = await Promise.all([
    prisma.transaction.findMany({
      distinct: ["currency"],
      select: { currency: true },
      where: owned,
    }),
    prisma.accountBalance.findMany({
      distinct: ["currency"],
      select: { currency: true },
      where: owned,
    }),
    prisma.holding.findMany({
      distinct: ["currency"],
      select: { currency: true },
      where: owned,
    }),
  ]);

  return [
    ...new Set(
      [...transactions, ...balances, ...holdings].map((row) => row.currency)
    ),
  ].toSorted();
};

export const userConverter = async (
  userId: string,
  from: Date,
  to: Date
): Promise<Converter> => {
  const [currency, held] = await Promise.all([
    userCurrency(userId),
    userHeldCurrencies(userId),
  ]);

  const now = new Date();

  return converterOf(
    currency,
    await loadRateBook([...held, currency], from, to < now ? to : now)
  );
};
