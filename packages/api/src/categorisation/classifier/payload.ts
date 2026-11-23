import type { CategoriseInput, OutgoingNegativeMinorUnits } from "../types";
import type { AmountBucket, ClassificationInput } from "./types";

const SMALL_FROM_MINOR = 1000;
const MEDIUM_FROM_MINOR = 5000;
const LARGE_FROM_MINOR = 20_000;

const amountBucket = (
  amountMinor: OutgoingNegativeMinorUnits
): AmountBucket => {
  const abs = Math.abs(amountMinor);

  if (abs < SMALL_FROM_MINOR) {
    return "micro";
  }

  if (abs < MEDIUM_FROM_MINOR) {
    return "small";
  }

  if (abs < LARGE_FROM_MINOR) {
    return "medium";
  }

  return "large";
};

export const classificationInputFrom = (
  input: CategoriseInput
): ClassificationInput | null => {
  const merchantKey = input.path === "iban" ? "" : input.merchantKey;
  const normalisedDescriptor =
    input.normalisedDescriptor ||
    (input.counterpartyName ?? "").trim().toLowerCase();

  if (!(merchantKey || normalisedDescriptor)) {
    return null;
  }

  return {
    amountBucket: amountBucket(input.amountMinor),
    channel: input.channel,
    counterpartyName: input.counterpartyName ?? null,
    country: input.country ?? null,
    currency: input.currency,
    direction: input.amountMinor > 0 ? "credit" : "debit",
    merchantCategoryCode: input.merchantCategoryCode ?? null,
    merchantKey: merchantKey || null,
    normalisedDescriptor,
    path: input.path,
  };
};
