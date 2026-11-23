import type {
  SpendingCategory,
  TransactionDirection,
} from "@freenary/api/lib/taxonomy";
import { Button } from "@freenary/ui/components/button";
import { RiResetLeftLine } from "@remixicon/react";

import { SpendingCategoryPicker } from "@/entities/category";
import { m } from "@/paraglide/messages.js";

export const TransactionCategoryPicker = ({
  category,
  currency,
  direction,
  isOverridden,
  onSelect,
  onReset,
}: {
  category: SpendingCategory;
  currency: string;
  direction: TransactionDirection;
  isOverridden: boolean;
  onSelect: (category: SpendingCategory) => void;
  onReset: () => void;
}) => (
  <div className="flex items-center gap-1">
    <SpendingCategoryPicker
      currency={currency}
      direction={direction}
      onValueChange={onSelect}
      value={category}
    />

    {isOverridden ? (
      <Button onClick={onReset} size="icon-compact" variant="ghost">
        <RiResetLeftLine />
        <span className="sr-only">{m.budget_category_reset()}</span>
      </Button>
    ) : null}
  </div>
);
