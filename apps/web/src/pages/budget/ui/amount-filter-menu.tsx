import { Badge } from "@freenary/ui/components/badge";
import { Button } from "@freenary/ui/components/button";
import { Field, FieldLabel } from "@freenary/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@freenary/ui/components/input-addons";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@freenary/ui/components/popover";
import { RiCoinsLine } from "@remixicon/react";
import { useEffect, useId, useRef, useState } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { currencySymbol } from "@/shared/lib/format-currency";
import { remixIcon } from "@/shared/lib/remix-icon";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";

import {
  EMPTY_AMOUNT_RANGE,
  parseAmountBound,
} from "../model/transaction-filters";
import type { AmountRange } from "../model/transaction-filters";

interface AmountFilterMenuProps {
  hint?: string;
  label?: string;
  onRangeChange: (range: AmountRange) => void;
  range: AmountRange;
}

const AMOUNT_SETTLE_MS = 400;
const NO_BOUND = 0;
const NO_BOUND_TEXT = "";

const draftOf = (range: AmountRange) => ({
  max: range.max > NO_BOUND ? String(range.max) : NO_BOUND_TEXT,
  min: range.min > NO_BOUND ? String(range.min) : NO_BOUND_TEXT,
});

export const AmountFilterMenu = ({
  hint = m.budget_filter_amount_hint(),
  label = m.budget_filter_amount(),
  onRangeChange,
  range,
}: AmountFilterMenuProps) => {
  const fieldId = useId();
  const locale = getLocale();
  const [draft, setDraft] = useState(() => draftOf(range));
  const settled = useDebouncedValue(draft, AMOUNT_SETTLE_MS);
  const applied = useRef(range);

  useEffect(() => {
    const next = {
      max: parseAmountBound(settled.max, locale),
      min: parseAmountBound(settled.min, locale),
    };

    if (next.min === applied.current.min && next.max === applied.current.max) {
      return;
    }

    applied.current = next;
    onRangeChange(next);
  }, [locale, onRangeChange, settled]);

  const isActive = range.min > NO_BOUND || range.max > NO_BOUND;
  const hasFloorAboveCeiling =
    range.min > NO_BOUND && range.max > NO_BOUND && range.min > range.max;

  const symbol = currencySymbol();

  const resyncDraftFromRange = () => {
    applied.current = range;
    setDraft(draftOf(range));
  };

  const clearBoundsWithoutWaitingForDebounce = () => {
    applied.current = EMPTY_AMOUNT_RANGE;
    setDraft({ max: "", min: "" });
    onRangeChange(EMPTY_AMOUNT_RANGE);
  };

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) {
          resyncDraftFromRange();
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button leadingIcon={remixIcon(RiCoinsLine)} variant="tertiary" />
        }
      >
        {label}
        {isActive && <Badge className="ml-1.5">1</Badge>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 gap-2.5">
        <div className="flex items-end gap-2">
          <Field>
            <FieldLabel htmlFor={`${fieldId}-min`}>
              {m.budget_filter_amount_min()}
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>{symbol}</InputGroupAddon>
              <InputGroupInput
                aria-invalid={hasFloorAboveCeiling}
                id={`${fieldId}-min`}
                inputMode="decimal"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    min: event.target.value,
                  }))
                }
                placeholder={m.budget_filter_amount_any()}
                value={draft.min}
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${fieldId}-max`}>
              {m.budget_filter_amount_max()}
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>{symbol}</InputGroupAddon>
              <InputGroupInput
                aria-invalid={hasFloorAboveCeiling}
                id={`${fieldId}-max`}
                inputMode="decimal"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    max: event.target.value,
                  }))
                }
                placeholder={m.budget_filter_amount_any()}
                value={draft.max}
              />
            </InputGroup>
          </Field>
        </div>
        <PopoverDescription
          className={hasFloorAboveCeiling ? "text-destructive" : ""}
        >
          {hasFloorAboveCeiling ? m.budget_filter_amount_impossible() : hint}
        </PopoverDescription>
        {isActive && (
          <Button
            className="self-start"
            onClick={clearBoundsWithoutWaitingForDebounce}
            variant="ghost"
          >
            {m.budget_filter_amount_clear()}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
};
