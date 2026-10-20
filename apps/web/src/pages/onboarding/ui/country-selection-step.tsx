import { Badge } from "@freenary/ui/components/badge";
import { Button } from "@freenary/ui/components/button";
import {
  Combobox,
  ComboboxChips,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@freenary/ui/components/combobox";
import { RiArrowRightLine, RiEarthLine } from "@remixicon/react";
import { useMemo } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { GITHUB_REPO_URL } from "@/shared/config";
import {
  countriesFor,
  countryMatches,
  isFullySupportedCountry,
} from "@/shared/lib/countries";
import { remixIcon } from "@/shared/lib/remix-icon";
import { WizardStepHeader } from "@/shared/ui/wizard-step-header";

interface CountrySelectionStepProps {
  isCompleting: boolean;
  onContinue: () => void;
  onCountriesChange: (countries: string[]) => void;
  selected: string[];
}

interface CountryRow {
  code: string;
  label: string;
  prefix: string;
  value: string;
}

export const CountrySelectionStep = ({
  isCompleting,
  onContinue,
  onCountriesChange,
  selected,
}: CountrySelectionStepProps) => {
  const locale = getLocale();

  const items = useMemo<CountryRow[]>(
    () =>
      countriesFor(locale).map((country) => ({
        code: country.code,
        label: country.name,
        prefix: country.flag,
        value: country.code,
      })),
    [locale]
  );

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description={m.onboarding_country_description()}
        title={m.onboarding_country_title()}
      />
      <Combobox
        filter={(item, query) => {
          // SAFETY: every item comes from `items`, built above.
          const row = item as CountryRow;

          return countryMatches(row.code, row.label, query);
        }}
        items={items}
        multiple
        onValueChange={onCountriesChange}
        value={selected}
      >
        <ComboboxChips
          aria-label={m.onboarding_country_search_placeholder()}
          clearable
          icon={remixIcon(RiEarthLine)}
          placeholder={m.onboarding_country_search_placeholder()}
        />
        <ComboboxContent>
          <ComboboxEmpty>{m.onboarding_country_empty()}</ComboboxEmpty>
          <ComboboxList>
            {(item) => {
              // SAFETY: every row comes from `items`, built above.
              const row = item as CountryRow;

              return (
                <ComboboxItem value={row.value}>
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="truncate">
                      <span aria-hidden="true">{row.prefix} </span>
                      {row.label}
                    </span>
                    {isFullySupportedCountry(row.code) ? null : (
                      <Badge variant="dot">
                        {m.onboarding_country_partial_badge()}
                      </Badge>
                    )}
                  </span>
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <p className="text-muted-foreground text-center text-xs">
        {m.onboarding_contribute_prompt()}{" "}
        <a
          className="text-primary underline underline-offset-2"
          href={GITHUB_REPO_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          {m.onboarding_contribute_link()}
        </a>
      </p>
      <div className="flex justify-end">
        <Button
          disabled={selected.length === 0 || isCompleting}
          loading={isCompleting}
          onClick={onContinue}
          trailingIcon={remixIcon(RiArrowRightLine)}
          type="button"
        >
          {m.onboarding_continue()}
        </Button>
      </div>
    </div>
  );
};
