export type TransactionExclusion = "MERCHANT" | "TRANSACTION";

export type ExclusionScope = "merchant" | "transaction";

export const EXCLUSION_OF_SCOPE = {
  merchant: "MERCHANT",
  transaction: "TRANSACTION",
} as const satisfies Record<ExclusionScope, TransactionExclusion>;
