import prisma from "@freenary/db";

const FALLBACK_CURRENCY = "EUR";

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
