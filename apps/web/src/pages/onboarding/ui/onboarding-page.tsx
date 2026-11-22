import { useQuery } from "@tanstack/react-query";

import { AuthGate } from "@/features/auth-gate";
import { useBankLinking } from "@/features/bank-connection";
import { orpc } from "@/shared/api";

import { useOnboardingWizard } from "../model/use-onboarding-wizard";
import { OnboardingWizard } from "./onboarding-wizard";

const OnboardingContent = () => {
  const bankLinking = useBankLinking();

  const wizard = useOnboardingWizard();

  const banksQuery = useQuery(
    orpc.bankConnection.listInstitutions.queryOptions({
      enabled: bankLinking === "available",
    })
  );

  const connectionsQuery = useQuery(
    orpc.bankConnection.listConnections.queryOptions()
  );

  return (
    <OnboardingWizard
      bankLinking={bankLinking}
      banks={banksQuery.data?.banks ?? []}
      connectedCount={connectionsQuery.data?.connections.length ?? 0}
      direction={wizard.direction}
      isBanksError={banksQuery.isError}
      isBanksPending={banksQuery.isPending}
      isCompleting={wizard.isCompleting}
      isPending={bankLinking === "pending"}
      onBack={wizard.handleBack}
      onCountriesChange={wizard.handleCountriesChange}
      onCountryContinue={wizard.handleCountryContinue}
      onFinish={wizard.handleFinish}
      onSignOut={wizard.handleSignOut}
      step={wizard.step}
      taxCountries={wizard.taxCountries}
    />
  );
};

export const OnboardingPage = () => (
  <AuthGate audience="onboarding">
    <OnboardingContent />
  </AuthGate>
);
