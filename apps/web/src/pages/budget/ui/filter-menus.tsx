import { predefinedCategoryAppearance } from "@freenary/api/lib/categories";
import { categoriesInGroup } from "@freenary/api/lib/taxonomy";
import type { SpendingCategory } from "@freenary/api/lib/taxonomy";
import type { TransactionFilter } from "@freenary/api/lib/transaction-filters";
import { Button } from "@freenary/ui/components/button";
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from "@freenary/ui/components/dropdown";
import { MenuItem } from "@freenary/ui/components/menu-item";
import { RiArrowDownSLine, RiBankLine } from "@remixicon/react";

import { categoryLabel, categoryMenuIcon } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";
import { remixIcon } from "@/shared/lib/remix-icon";

import {
  AMOUNT_PRESETS,
  replacingField,
  singleValueOf,
} from "../model/filter-menus";
import type { AmountPreset, MonthChoice } from "../model/filter-menus";
import type { AccountChoice } from "../model/filter-suggestions";

interface FilterMenusProps {
  accounts: readonly AccountChoice[];
  currency: string;
  filters: readonly TransactionFilter[];
  months: readonly MonthChoice[];
  onFiltersChange: (filters: TransactionFilter[]) => void;
  onMonthPick: (choice: MonthChoice) => void;
}

const ChevronIcon = remixIcon(RiArrowDownSLine);

const AccountIcon = remixIcon(RiBankLine);

const SPENDING = categoriesInGroup("spending");

const SPENDING_VALUES: readonly string[] = SPENDING;

const NOTHING_CHECKED = -1;

const amountPresetLabel = (preset: AmountPreset, currency: string) => {
  const amount = formatCurrency(preset.minorUnits, currency);

  return preset.operator === "gt"
    ? m.budget_filter_amount_over({ amount })
    : m.budget_filter_amount_under({ amount });
};

const FilterMenu = ({
  checkedIndex,
  children,
  label,
}: {
  checkedIndex: number;
  children: React.ReactNode;
  label: string;
}) => (
  <DropdownMenu>
    <DropdownTrigger
      render={
        <Button size="compact" trailingIcon={ChevronIcon} variant="ghost" />
      }
    >
      {label}
    </DropdownTrigger>
    <DropdownContent
      align="start"
      checkedIndex={checkedIndex === NOTHING_CHECKED ? undefined : checkedIndex}
      className="max-h-80 min-w-48 overflow-y-auto"
    >
      {children}
    </DropdownContent>
  </DropdownMenu>
);

export const FilterMenus = ({
  accounts,
  currency,
  filters,
  months,
  onFiltersChange,
  onMonthPick,
}: FilterMenusProps) => {
  const pickedCategory = singleValueOf(filters, "category");
  const pickedAccount = singleValueOf(filters, "account");
  const pickedAmount = filters.find((filter) => filter.field === "amount");

  const pick = (filter: TransactionFilter) =>
    onFiltersChange(replacingField(filters, filter));

  return (
    <div className="flex flex-wrap items-center gap-1">
      <FilterMenu
        checkedIndex={SPENDING_VALUES.indexOf(pickedCategory ?? "")}
        label={m.budget_filter_field_category()}
      >
        {SPENDING.map((category: SpendingCategory, index) => (
          <MenuItem
            checked={category === pickedCategory}
            icon={categoryMenuIcon(predefinedCategoryAppearance(category))}
            index={index}
            key={category}
            label={categoryLabel(category)}
            onSelect={() =>
              pick({ field: "category", operator: "is", values: [category] })
            }
          />
        ))}
      </FilterMenu>
      <FilterMenu
        checkedIndex={accounts.findIndex(
          (account) => account.id === pickedAccount
        )}
        label={m.budget_filter_field_account()}
      >
        {accounts.map((account, index) => (
          <MenuItem
            checked={account.id === pickedAccount}
            icon={AccountIcon}
            index={index}
            key={account.id}
            label={account.label}
            onSelect={() =>
              pick({ field: "account", operator: "is", values: [account.id] })
            }
          />
        ))}
      </FilterMenu>
      <FilterMenu
        checkedIndex={AMOUNT_PRESETS.findIndex(
          (preset) =>
            pickedAmount?.field === "amount" &&
            pickedAmount.operator === preset.operator &&
            pickedAmount.value === preset.minorUnits
        )}
        label={m.budget_filter_field_amount()}
      >
        {AMOUNT_PRESETS.map((preset, index) => (
          <MenuItem
            index={index}
            key={`${preset.operator}-${preset.minorUnits}`}
            label={amountPresetLabel(preset, currency)}
            onSelect={() =>
              pick({
                field: "amount",
                operator: preset.operator,
                value: preset.minorUnits,
              })
            }
          />
        ))}
      </FilterMenu>
      <FilterMenu
        checkedIndex={months.findIndex((month) => month.isCurrent)}
        label={m.budget_filter_field_date()}
      >
        {months.map((month, index) => (
          <MenuItem
            checked={month.isCurrent}
            index={index}
            key={`${month.year}-${month.month}`}
            label={month.label}
            onSelect={() => onMonthPick(month)}
          />
        ))}
      </FilterMenu>
    </div>
  );
};
