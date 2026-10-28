import type { Prisma } from "@freenary/db";

export interface AmountBounds {
  readonly maximumAbsoluteMinorUnits?: number;
  readonly minimumAbsoluteMinorUnits?: number;
}

export type AmountBoundsCondition = Prisma.TransactionWhereInput | null;

export const amountBoundsCondition = ({
  maximumAbsoluteMinorUnits,
  minimumAbsoluteMinorUnits,
}: AmountBounds): AmountBoundsCondition => {
  if (
    minimumAbsoluteMinorUnits === undefined &&
    maximumAbsoluteMinorUnits === undefined
  ) {
    return null;
  }

  const incoming: Prisma.IntFilter = { gt: 0 };
  const outgoing: Prisma.IntFilter = { lt: 0 };

  if (minimumAbsoluteMinorUnits !== undefined) {
    incoming.gte = minimumAbsoluteMinorUnits;
    outgoing.lte = -minimumAbsoluteMinorUnits;
  }

  if (maximumAbsoluteMinorUnits !== undefined) {
    incoming.lte = maximumAbsoluteMinorUnits;
    outgoing.gte = -maximumAbsoluteMinorUnits;
  }

  return { OR: [{ amount: incoming }, { amount: outgoing }] };
};
