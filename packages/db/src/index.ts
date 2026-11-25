import { env } from "@freenary/env/server";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../prisma/generated/client";

export const MAX_SAFE_MINOR_UNITS = Number.MAX_SAFE_INTEGER;

export const minorUnitsOf = (stored: bigint | number): number => {
  const exact = BigInt(stored);

  if (
    exact > BigInt(MAX_SAFE_MINOR_UNITS) ||
    exact < BigInt(-MAX_SAFE_MINOR_UNITS)
  ) {
    throw new RangeError(
      `${exact} minor units is beyond what a JavaScript number holds exactly`
    );
  }

  return Number(exact);
};

const optionalMinorUnitsOf = (stored: bigint | null): number | null =>
  stored === null ? null : minorUnitsOf(stored);

// SAFETY: the computed key of `needs` is the one field F
const asNumber = <F extends string>(field: F) => ({
  compute: (row: Record<F, bigint>) => minorUnitsOf(row[field]),
  needs: { [field]: true } as Record<F, true>,
});

// SAFETY: the computed key of `needs` is the one field F
const asOptionalNumber = <F extends string>(field: F) => ({
  compute: (row: Record<F, bigint | null>) => optionalMinorUnitsOf(row[field]),
  needs: { [field]: true } as Record<F, true>,
});

const createPrismaClient = () => {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
  });

  return new PrismaClient({ adapter }).$extends({
    result: {
      accountBalance: { balanceMinor: asNumber("balanceMinor") },
      bankAccount: { balanceMinor: asOptionalNumber("balanceMinor") },
      budgetLine: { amount: asNumber("amount") },
      holding: {
        unrealisedGainMinor: asOptionalNumber("unrealisedGainMinor"),
        valuationMinor: asNumber("valuationMinor"),
      },
      transaction: {
        amount: asNumber("amount"),
        balanceAfterTransaction: asOptionalNumber("balanceAfterTransaction"),
        exchangeFeeMinor: asOptionalNumber("exchangeFeeMinor"),
        originalAmount: asOptionalNumber("originalAmount"),
      },
    },
  });
};

const prisma = createPrismaClient();

export type DbClient = typeof prisma;

export type TransactionClient = Omit<
  DbClient,
  "$connect" | "$disconnect" | "$extends" | "$on" | "$transaction"
>;

export { Prisma } from "../prisma/generated/client";

export default prisma;
