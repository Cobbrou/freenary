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

export const lowConfidenceTransactionIds = (
  transactionIds: readonly string[],
  resolutions: readonly (ResolutionResult | undefined)[]
): string[] =>
  transactionIds.flatMap((transactionId, index) => {
    const resolution = resolutions[index];

    return resolution && isLowConfidence(resolution) ? [transactionId] : [];
  });

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
