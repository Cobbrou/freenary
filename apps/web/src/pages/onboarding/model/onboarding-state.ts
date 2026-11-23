import { budgetMonthSettingInput } from "@freenary/api/lib/budget-month";
import { Option } from "effect";
import { z } from "zod";

import { isServer } from "@/shared/lib/is-server";

const onboardingStateSchema = z.object({
  budgetMonth: budgetMonthSettingInput.optional(),
  taxCountries: z.array(z.string()).min(1),
});

export type OnboardingState = z.infer<typeof onboardingStateSchema>;

const STORAGE_KEY = "freenary:onboarding";

const decodeStoredState = Option.liftThrowable((raw: string) =>
  onboardingStateSchema.parse(JSON.parse(raw))
);

export const persistOnboardingState = (state: OnboardingState) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const storedState = (): string | null =>
  isServer ? null : sessionStorage.getItem(STORAGE_KEY);

export const loadOnboardingState = (): OnboardingState | null =>
  Option.fromNullishOr(storedState()).pipe(
    Option.flatMap(decodeStoredState),
    Option.getOrElse(() => null)
  );

export const clearOnboardingState = () => {
  sessionStorage.removeItem(STORAGE_KEY);
};
