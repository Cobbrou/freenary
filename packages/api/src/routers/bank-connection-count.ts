import prisma from "@freenary/db";

import { isOperator, operatorProcedureWith } from "../index";

interface BankConnectionCountSource {
  countConnections: () => Promise<number>;
  isOperatorAccount: (userId: string) => Promise<boolean>;
}

export const bankConnectionCountWith = ({
  countConnections,
  isOperatorAccount,
}: BankConnectionCountSource) =>
  operatorProcedureWith(isOperatorAccount).handler(async () => ({
    count: await countConnections(),
  }));

export const bankConnectionCount = bankConnectionCountWith({
  countConnections: () => prisma.bankConnection.count(),
  isOperatorAccount: isOperator,
});
