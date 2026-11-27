import type { ExclusionScope } from "@freenary/api/lib/exclusion-scope";
import { INTERNAL_TRANSFER_CATEGORY } from "@freenary/api/lib/taxonomy";

import type { Transaction } from "@/entities/budget";
import { m } from "@/paraglide/messages.js";

interface ExclusionAction {
  isExcluded: boolean;
  label: string;
  scope: Exclude<ExclusionScope, "account">;
}

export const exclusionActionsOf = (
  transaction: Transaction
): ExclusionAction[] => {
  if (transaction.exclusion === "ACCOUNT") {
    return [];
  }

  if (transaction.exclusion === "MERCHANT") {
    return [
      {
        isExcluded: false,
        label: m.budget_detail_include_merchant(),
        scope: "merchant",
      },
    ];
  }

  const canExcludeMerchant =
    transaction.hasMerchant === true &&
    transaction.category !== INTERNAL_TRANSFER_CATEGORY;

  return canExcludeMerchant
    ? [
        {
          isExcluded: true,
          label: m.budget_detail_exclude_merchant(),
          scope: "merchant",
        },
      ]
    : [];
};
