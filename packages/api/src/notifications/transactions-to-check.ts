import prisma from "@freenary/db";
import type { Prisma } from "@freenary/db";

import { AUTO_BAND_MIN_CONFIDENCE } from "../categorisation/resolve";
import type {
  ResolutionResult,
  ResolutionStage,
} from "../categorisation/types";
import { NOTIFICATION_TYPES } from "./types";

const CLASSIFIER_STAGES = [
  "model",
  "cached-model",
] as const satisfies readonly ResolutionStage[];

const isClassifierStage = (stage: ResolutionStage): boolean =>
  CLASSIFIER_STAGES.some((classifier) => classifier === stage);

export const isLowConfidence = (resolution: ResolutionResult): boolean =>
  resolution.category !== null &&
  resolution.band === "suggest" &&
  isClassifierStage(resolution.stage);

export const TO_CHECK_WINDOW_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

export const lowConfidenceTransactionIds = (
  transactions: readonly { date: Date; id: string }[],
  resolutions: readonly (ResolutionResult | undefined)[],
  now: Date = new Date()
): string[] => {
  const since = now.getTime() - TO_CHECK_WINDOW_DAYS * DAY_MS;

  return transactions.flatMap((transaction, index) => {
    const resolution = resolutions[index];

    return resolution &&
      isLowConfidence(resolution) &&
      transaction.date.getTime() >= since
      ? [transaction.id]
      : [];
  });
};

export const stillToCheck: Prisma.TransactionWhereInput = {
  category: null,
  categoryOverride: false,
  resolutionConfidence: { lt: AUTO_BAND_MIN_CONFIDENCE },
  resolutionStage: { in: [...CLASSIFIER_STAGES] },
  resolvedCategory: { not: null },
};

export const notifyTransactionsToCheck = async (
  userId: string,
  transactionIds: readonly string[]
): Promise<string | null> => {
  if (transactionIds.length === 0) {
    return null;
  }

  const alreadyRaised = await prisma.notificationTransaction.findMany({
    select: { transactionId: true },
    where: {
      notification: { userId },
      transactionId: { in: [...transactionIds] },
    },
  });

  const raised = new Set(alreadyRaised.map((link) => link.transactionId));
  const fresh = transactionIds.filter((id) => !raised.has(id));

  if (fresh.length === 0) {
    return null;
  }

  const notification = await prisma.notification.create({
    data: {
      transactions: {
        create: fresh.map((transactionId) => ({ transactionId })),
      },
      type: NOTIFICATION_TYPES.transactionsToCheck,
      userId,
    },
    select: { id: true },
  });

  return notification.id;
};
