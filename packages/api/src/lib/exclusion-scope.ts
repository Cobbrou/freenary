export type TransactionExclusion = "ACCOUNT" | "MERCHANT" | "TRANSACTION";

export type ExclusionScope = "account" | "merchant" | "transaction";

export const EXCLUSION_OF_SCOPE = {
  account: "ACCOUNT",
  merchant: "MERCHANT",
  transaction: "TRANSACTION",
} as const satisfies Record<ExclusionScope, TransactionExclusion>;

export const MAX_EXCLUSION_REASON_LENGTH = 200;

export const exclusionReasonOf = (
  reason: string | null | undefined
): string | null => {
  const trimmed = reason?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
};
