import { useQuery } from "@tanstack/react-query";

import { AuthGate } from "@/features/auth-gate";
import { orpc } from "@/shared/api";

import { useOnboardingWizard } from "../model/use-onboarding-wizard";
import { OnboardingWizard } from "./onboarding-wizard";

const BANK_STEP_INDEX = 1;

const OnboardingContent = () => {
  const availability = useQuery(
    orpc.bankConnection.getProviderAvailability.queryOptions()
  );

  const hasBankStep = availability.data?.available ?? false;

  const wizard = useOnboardingWizard({ hasBankStep });
  const isBankStepReachable = hasBankStep || wizard.step === BANK_STEP_INDEX;

  const banksQuery = useQuery(
    orpc.bankConnection.listInstitutions.queryOptions({
      enabled: wizard.taxCountries.length > 0 && isBankStepReachable,
      input: { countries: wizard.taxCountries },
    })
  );

  const connectionsQuery = useQuery(
    orpc.bankConnection.listConnections.queryOptions()
  );

  return (
    <OnboardingWizard
      banks={banksQuery.data?.banks ?? []}
      connectedCount={connectionsQuery.data?.connections.length ?? 0}
      direction={wizard.direction}
      hasBankStep={hasBankStep}
      isBanksError={banksQuery.isError}
      isBanksPending={banksQuery.isPending}
      isCompleting={wizard.isCompleting}
      isPending={availability.isLoading}
      onBack={wizard.handleBack}
      onCountriesChange={wizard.handleCountriesChange}
      onCountryContinue={wizard.handleCountryContinue}
      onFinish={wizard.handleFinish}
      onSignOut={wizard.handleSignOut}
      step={wizard.step}
      taxCountries={wizard.taxCountries}
      unavailableCountries={banksQuery.data?.unavailableCountries ?? []}
    />
  );
};

export const OnboardingPage = () => (
  <AuthGate audience="onboarding">
    <OnboardingContent />
  </AuthGate>
);
