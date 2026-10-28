import prisma from "@freenary/db";
import { Option } from "effect";

import type { SpendingCategory } from "../../lib/taxonomy";
import { resolveCategorySlug, TAXONOMY_VERSION } from "../../lib/taxonomy";
import type { TransactionClassifier } from "./types";

export interface CachedClassification {
  category: SpendingCategory | null;
  confidence: number | null;
  classifiedAt: Date;
}

export interface ClassificationRecord {
  classifier: Pick<TransactionClassifier, "provider" | "model">;
  category: SpendingCategory | null;
  confidence: number | null;
  answeredBy: string | null;
}

export interface ClassificationStore {
  failedAt: Map<string, number>;
  find: (signature: string) => Promise<CachedClassification | null>;
  save: (signature: string, record: ClassificationRecord) => Promise<void>;
}

const findClassification = async (
  signature: string
): Promise<CachedClassification | null> => {
  const stored = await prisma.merchantClassification
    .findUnique({ where: { signature } })
    .then(Option.fromNullishOr, Option.none);

  return Option.match(stored, {
    onNone: () => null,
    onSome: (row) => {
      const category = row.category ? resolveCategorySlug(row.category) : null;

      if (row.category && !category) {
        return null;
      }

      return {
        category,
        classifiedAt: row.classifiedAt,
        confidence: row.confidence,
      };
    },
  });
};

const saveClassification = async (
  signature: string,
  record: ClassificationRecord
): Promise<void> => {
  const row = {
    answeredBy: record.answeredBy,
    category: record.category,
    classifiedAt: new Date(),
    confidence: record.confidence,
    model: record.classifier.model,
    provider: record.classifier.provider,
    taxonomyVersion: TAXONOMY_VERSION,
  };

  await prisma.merchantClassification
    .upsert({
      create: { ...row, signature },
      update: row,
      where: { signature },
    })
    .then(Option.some, Option.none);
};

export const prismaClassificationStore: ClassificationStore = {
  failedAt: new Map(),
  find: findClassification,
  save: saveClassification,
};
