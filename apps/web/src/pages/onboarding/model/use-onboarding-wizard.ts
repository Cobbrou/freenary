import {
  DEFAULT_BUDGET_MONTH_ANCHOR,
  DEFAULT_BUDGET_MONTH_START_DAY,
} from "@freenary/api/lib/budget-month";
import type { BudgetMonthSetting } from "@freenary/api/lib/budget-month";
import { ORPCError } from "@orpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";
import { client, orpc } from "@/shared/api";
import { authClient } from "@/shared/auth";

import {
  clearOnboardingState,
  loadOnboardingState,
  persistOnboardingState,
} from "./onboarding-state";
import { ONBOARDING_STEPS, resumedStep } from "./steps";

type CompletionOutcome = "completed" | "failed" | "needs-bank";

const outcomeOfFailure = (error: Error): CompletionOutcome =>
  error instanceof ORPCError && error.code === "PRECONDITION_FAILED"
    ? "needs-bank"
    : "failed";

export const useOnboardingWizard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refetch: refetchSession } = authClient.useSession();
  const [step, setStep] = useState(() => resumedStep(loadOnboardingState()));
  const [direction, setDirection] = useState<1 | -1>(1);
  const [taxCountries, setTaxCountries] = useState<string[]>(
    () => loadOnboardingState()?.taxCountries ?? []
  );

  const [budgetMonth, setBudgetMonth] = useState<BudgetMonthSetting>(
    () =>
      loadOnboardingState()?.budgetMonth ?? {
        anchor: DEFAULT_BUDGET_MONTH_ANCHOR,
        country: loadOnboardingState()?.taxCountries[0] ?? null,
        startDay: DEFAULT_BUDGET_MONTH_START_DAY,
      }
  );

  const [isCompleting, setIsCompleting] = useState(false);

  const completeOnboarding = async () => {
    if (taxCountries.length === 0) {
      return;
    }

    setIsCompleting(true);
    const outcome = await client.onboarding
      .completeOnboarding({ budgetMonth, taxCountries })
      .then((): CompletionOutcome => "completed")
      .catch(outcomeOfFailure);

    if (outcome === "completed") {
      clearOnboardingState();
      await queryClient.invalidateQueries({
        queryKey: orpc.onboarding.getStatus.queryOptions().queryKey,
      });

      toast.success(m.onboarding_completed_toast());
      navigate({ to: "/" });
    } else if (outcome === "needs-bank") {
      await queryClient.invalidateQueries({
        queryKey: orpc.bankConnection.listConnections.queryOptions().queryKey,
      });

      toast.error(m.onboarding_error_no_bank());
    } else {
      toast.error(m.onboarding_error_generic());
    }

    setIsCompleting(false);
  };

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const handleBack = () => {
    goTo(Math.max(ONBOARDING_STEPS.country, step - 1));
  };

  const handleCountriesChange = (codes: string[]) => {
    setTaxCountries(codes);
  };

  const handleCountryContinue = () => {
    if (taxCountries.length > 0) {
      persistOnboardingState({ taxCountries });
    }

    if (
      budgetMonth.country === null ||
      !taxCountries.includes(budgetMonth.country)
    ) {
      setBudgetMonth({ ...budgetMonth, country: taxCountries[0] ?? null });
    }

    goTo(ONBOARDING_STEPS.budgetMonth);
  };

  const handleBudgetMonthContinue = () => {
    if (taxCountries.length > 0) {
      persistOnboardingState({ budgetMonth, taxCountries });
    }

    goTo(ONBOARDING_STEPS.bank);
  };

  const handleFinish = () => {
    void completeOnboarding();
  };

  const handleSignOut = () => {
    clearOnboardingState();
    authClient.signOut({
      fetchOptions: {
        onSuccess: async () => {
          await refetchSession();
          await navigate({ to: "/login" });
          queryClient.clear();
        },
      },
    });
  };

  return {
    budgetMonth,
    direction,
    handleBack,
    handleBudgetMonthChange: setBudgetMonth,
    handleBudgetMonthContinue,
    handleCountriesChange,
    handleCountryContinue,
    handleFinish,
    handleSignOut,
    isCompleting,
    step,
    taxCountries,
  };
};
