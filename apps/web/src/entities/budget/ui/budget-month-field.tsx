import { BUDGET_MONTH_ANCHORS } from "@freenary/api/lib/budget-month";
import type {
  BudgetMonthAnchor,
  BudgetMonthSetting,
} from "@freenary/api/lib/budget-month";
import { holidayCountries } from "@freenary/api/lib/public-holidays";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@freenary/ui/components/select";
import { useMemo } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

import {
  BudgetMonthExample,
  BudgetMonthStartInput,
} from "./budget-month-start-input";

interface BudgetMonthFieldProps {
  disabled?: boolean;
  onChange: (setting: BudgetMonthSetting) => void;
  value: BudgetMonthSetting;
}

const ANCHOR_LABELS = {
  DAY_OF_MONTH: m.budget_month_anchor_day_of_month,
  LAST_DAY: m.budget_month_anchor_last_day,
  LAST_WORKING_DAY: m.budget_month_anchor_last_working_day,
} satisfies Record<BudgetMonthAnchor, () => string>;

const ANCHOR_TRIGGER_WIDTH = "w-52";

const COUNTRY_TRIGGER_WIDTH = "w-52";

const HolidayCountrySelect = ({
  disabled,
  onValueChange,
  value,
}: {
  disabled?: boolean;
  onValueChange: (country: string) => void;
  value: string | null;
}) => {
  const locale = getLocale();
  const countries = useMemo(
    () =>
      Object.entries(holidayCountries(locale)).toSorted(([, a], [, b]) =>
        a.localeCompare(b, locale)
      ),
    [locale]
  );

  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">
        {m.budget_month_holiday_country_label()}
      </span>
      <Select
        disabled={disabled}
        onValueChange={onValueChange}
        value={value ?? undefined}
      >
        <SelectTrigger
          aria-label={m.budget_month_holiday_country_label()}
          className={COUNTRY_TRIGGER_WIDTH}
          placeholder={m.budget_month_holiday_country_label()}
        />
        <SelectContent>
          <SelectGroup>
            {countries.map(([code, name], position) => (
              <SelectItem index={position} key={code} value={code}>
                {name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

export const BudgetMonthField = ({
  disabled,
  onChange,
  value,
}: BudgetMonthFieldProps) => (
  <div className="flex flex-col gap-3">
    <Select
      disabled={disabled}
      onValueChange={(next: string) => {
        const anchor = BUDGET_MONTH_ANCHORS.find(
          (candidate) => candidate === next
        );

        if (anchor && anchor !== value.anchor) {
          onChange({ ...value, anchor });
        }
      }}
      value={value.anchor}
    >
      <SelectTrigger
        aria-label={m.budget_month_anchor_label()}
        className={ANCHOR_TRIGGER_WIDTH}
        placeholder={m.budget_month_anchor_label()}
      />
      <SelectContent>
        <SelectGroup>
          {BUDGET_MONTH_ANCHORS.map((anchor, position) => (
            <SelectItem index={position} key={anchor} value={anchor}>
              {ANCHOR_LABELS[anchor]()}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
    {value.anchor === "DAY_OF_MONTH" ? (
      <BudgetMonthStartInput
        disabled={disabled}
        onValueChange={(startDay) => onChange({ ...value, startDay })}
        value={value.startDay}
      />
    ) : null}
    {value.anchor === "LAST_WORKING_DAY" ? (
      <HolidayCountrySelect
        disabled={disabled}
        onValueChange={(country) => onChange({ ...value, country })}
        value={value.country}
      />
    ) : null}
    <BudgetMonthExample setting={value} />
  </div>
);
