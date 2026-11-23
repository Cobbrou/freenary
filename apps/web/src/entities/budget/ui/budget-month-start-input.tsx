import {
  budgetMonthOfDay,
  budgetMonthRuleOf,
  budgetMonthStartDaySchema,
  DEFAULT_BUDGET_MONTH_START_DAY,
  MAX_BUDGET_MONTH_START_DAY,
} from "@freenary/api/lib/budget-month";
import type { BudgetMonthSetting } from "@freenary/api/lib/budget-month";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@freenary/ui/components/input-addons";
import { useId, useState } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { useNow } from "@/shared/lib/calendar-day";

import { budgetMonthExample } from "../model/budget-month-label";

interface BudgetMonthStartInputProps {
  disabled?: boolean;
  onValueChange: (startDay: number) => void;
  value: number;
}

const GROUP_WIDTH = "w-24";

const parsedStartDay = (draft: string): number | null => {
  const parsed = budgetMonthStartDaySchema.safeParse(Number(draft));

  return draft.trim() !== "" && parsed.success ? parsed.data : null;
};

export const BudgetMonthStartInput = ({
  disabled,
  onValueChange,
  value,
}: BudgetMonthStartInputProps) => {
  const errorId = useId();
  const [editing, setEditing] = useState<string | null>(null);
  const draft = editing ?? String(value);

  const startDay = parsedStartDay(draft);
  const isInvalid = startDay === null;

  const commit = () => {
    if (startDay !== null && startDay !== value) {
      onValueChange(startDay);
    }

    setEditing(null);
  };

  return (
    <div className="flex flex-col gap-1">
      <InputGroup className={GROUP_WIDTH}>
        <InputGroupInput
          aria-describedby={isInvalid ? errorId : undefined}
          aria-invalid={isInvalid}
          aria-label={m.budget_month_start_label()}
          className="tabular-nums"
          disabled={disabled}
          inputMode="numeric"
          max={MAX_BUDGET_MONTH_START_DAY}
          min={DEFAULT_BUDGET_MONTH_START_DAY}
          onBlur={commit}
          onChange={(event) => setEditing(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit();
            }
          }}
          step={1}
          type="number"
          value={draft}
        />
        <InputGroupAddon align="inline-end">
          {m.budget_month_start_unit()}
        </InputGroupAddon>
      </InputGroup>
      {isInvalid ? (
        <p className="text-destructive text-xs" id={errorId}>
          {m.budget_month_start_invalid()}
        </p>
      ) : null}
    </div>
  );
};

export const BudgetMonthExample = ({
  setting,
}: {
  setting: BudgetMonthSetting;
}) => {
  const today = useNow();
  const rule = budgetMonthRuleOf(setting);
  const month = budgetMonthOfDay(
    {
      date: today.getDate(),
      month: today.getMonth(),
      year: today.getFullYear(),
    },
    rule
  );

  return (
    <p className="text-muted-foreground text-xs">
      {m.budget_month_start_example(
        budgetMonthExample(month, rule, getLocale())
      )}
    </p>
  );
};
