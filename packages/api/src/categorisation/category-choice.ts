import type { TransactionClient } from "@freenary/db";

import { INTERNAL_TRANSFER_CATEGORY } from "../lib/taxonomy";
import type { SpendingCategory } from "../lib/taxonomy";
import { releaseInferredSiblings } from "./internal-transfer-choice";
import {
  deleteUserOverride,
  upsertUserOverride,
  userCategoryUpdate,
} from "./user-override";

interface ChosenTransaction {
  counterpartyName: string | null;
  isInternalTransfer: boolean;
  merchantKey: string | null;
}

export const applyCategoryChoice = async (
  db: TransactionClient,
  userId: string,
  tx: ChosenTransaction,
  {
    category,
    transactionId,
  }: { category: SpendingCategory | null; transactionId: string }
): Promise<number> => {
  await db.transaction.update({
    data: userCategoryUpdate(category, tx.isInternalTransfer),
    where: { id: transactionId },
  });

  if (!tx.merchantKey) {
    return 0;
  }

  const siblings = {
    account: { connection: { userId } },
    categoryOverride: false,
    id: { not: transactionId },
    merchantKey: tx.merchantKey,
  };

  if (category === null) {
    await deleteUserOverride(userId, tx.merchantKey, db);

    const { count } = await db.transaction.updateMany({
      data: { category: null },
      where: siblings,
    });

    return count;
  }

  await upsertUserOverride(
    userId,
    tx.merchantKey,
    category,
    tx.counterpartyName,
    db
  );

  if (category !== INTERNAL_TRANSFER_CATEGORY) {
    await releaseInferredSiblings(db, userId, tx.merchantKey, transactionId);
  }

  const { count } = await db.transaction.updateMany({
    data: { category },
    where: siblings,
  });

  return count;
};
