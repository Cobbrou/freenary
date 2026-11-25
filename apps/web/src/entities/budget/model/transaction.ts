import { fromMinor } from "@freenary/api/lib/money";
import type { SpendingCategory } from "@freenary/api/lib/taxonomy";

import { merchantName } from "@/shared/lib/text";

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  category: SpendingCategory;
  derivedCategory: SpendingCategory;
  description: string;
  counterpartyName: string | null;
  normalisedDescriptor: string | null;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  exchangeFeeMinor?: number | null;
  isInternalTransfer?: boolean;
}

export interface OriginalAmount {
  amountMinor: number;
  currency: string;
}

export const transactionTitle = (transaction: Transaction): string =>
  merchantName(transaction);

export const originalAmountOf = (
  transaction: Transaction
): OriginalAmount | null => {
  const { originalAmount, originalCurrency } = transaction;

  if (
    originalAmount === null ||
    originalAmount === undefined ||
    !originalCurrency ||
    originalCurrency === transaction.currency
  ) {
    return null;
  }

  return { amountMinor: originalAmount, currency: originalCurrency };
};

export const exchangeRateOf = (transaction: Transaction): number | null => {
  const original = originalAmountOf(transaction);

  if (original === null || original.amountMinor === 0) {
    return null;
  }

  return Math.abs(
    fromMinor(transaction.amount, transaction.currency) /
      fromMinor(original.amountMinor, original.currency)
  );
};
