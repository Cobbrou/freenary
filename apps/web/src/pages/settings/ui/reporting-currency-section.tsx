import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@freenary/ui/components/select";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { useMemo } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

import {
  AUTOMATIC_CURRENCY,
  useReportingCurrencySetting,
} from "../model/use-reporting-currency-setting";
import { SettingsSection } from "./settings-section";

const FIELD_SKELETON = "h-8 w-80";

const TRIGGER_WIDTH = "w-80 max-w-full";

const RATES_DATE: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
};

const currencyOptionLabel = (code: string, names: Intl.DisplayNames) => {
  const name = names.of(code);

  return name && name !== code ? `${code} · ${name}` : code;
};

const RatesLine = ({ ratesAsOf }: { ratesAsOf: string | null }) => (
  <p className="text-muted-foreground text-xs">
    {ratesAsOf === null
      ? m.settings_reporting_currency_no_rates()
      : m.settings_reporting_currency_rates({
          date: new Date(ratesAsOf).toLocaleDateString(getLocale(), RATES_DATE),
        })}
  </p>
);

export const ReportingCurrencySection = () => {
  const { choice, isSaving, loadError, reporting, save } =
    useReportingCurrencySetting();

  const locale = getLocale();
  const choices = useMemo(() => {
    if (reporting === undefined) {
      return [];
    }

    const names = new Intl.DisplayNames([locale], { type: "currency" });

    return [
      {
        label: m.settings_reporting_currency_automatic({
          currency: currencyOptionLabel(reporting.detected, names),
        }),
        value: AUTOMATIC_CURRENCY,
      },
      ...reporting.options.map((code) => ({
        label: currencyOptionLabel(code, names),
        value: code,
      })),
    ];
  }, [locale, reporting]);

  const renderField = () => {
    if (reporting !== undefined) {
      return (
        <>
          <Select
            disabled={isSaving}
            onValueChange={(next: string) => {
              if (next !== choice) {
                save(next);
              }
            }}
            value={choice}
          >
            <SelectTrigger
              aria-label={m.settings_reporting_currency_title()}
              className={TRIGGER_WIDTH}
              placeholder={m.settings_reporting_currency_title()}
            />
            <SelectContent>
              <SelectGroup>
                {choices.map((option, position) => (
                  <SelectItem
                    index={position}
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <RatesLine ratesAsOf={reporting.ratesAsOf} />
        </>
      );
    }

    return loadError ? null : <Skeleton className={FIELD_SKELETON} />;
  };

  return (
    <SettingsSection
      description={m.settings_reporting_currency_description()}
      title={m.settings_reporting_currency_title()}
    >
      {renderField()}
    </SettingsSection>
  );
};
