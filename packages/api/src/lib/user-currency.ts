import prisma from "@freenary/db";

import { mostFrequentCurrency } from "./accounts-summary";

export const userCurrency = async (userId: string): Promise<string> => {
  const accounts = await prisma.bankAccount.groupBy({
    _count: { _all: true },
    by: ["currency"],
    where: { connection: { userId }, currency: { not: null } },
  });

  return mostFrequentCurrency(
    new Map(
      accounts.flatMap(({ _count, currency }) =>
        currency ? [[currency, _count._all] as const] : []
      )
    )
  );
};
