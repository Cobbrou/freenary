import { useState } from "react";

import type { SaveOutcome } from "../model/outcome";
import { initialChoiceOf, offersSkipButton } from "../model/variant-choice";
import type { IntegrationWording } from "../model/wording";
import { ProviderChoice } from "./provider-choice";
import { ProviderCredentials } from "./provider-credentials";
import type { SetupFieldDescriptor } from "./setup-field";

export interface SetupVariantDescriptor {
  fields: SetupFieldDescriptor[];
  id: string;
  legacy: boolean;
  recommended: boolean;
}

export interface SetupIntegrationDescriptor {
  configuredBy: string | null;
  discriminantKey: string;
  discriminantSource: string;
  id: string;
  requiredForSetup: boolean;
  selectedVariantId: string;
  shownInSetup: boolean;
  state: string;
  variants: SetupVariantDescriptor[];
}

interface ProviderStepProps {
  descriptor: SetupIntegrationDescriptor;
  isBusy: boolean;
  isFirstStep: boolean;
  onBack: () => void;
  onEdit: () => void;
  onSave: (
    variantId: string,
    values: Record<string, string>,
    checkFirst: boolean
  ) => void;
  onSkip: () => void;
  outcome: SaveOutcome | undefined;
  wording?: IntegrationWording;
}

export const ProviderStep = ({
  descriptor,
  isBusy,
  isFirstStep,
  onBack,
  onEdit,
  onSave,
  onSkip,
  outcome,
  wording = "setup",
}: ProviderStepProps) => {
  const [chosen, setChosen] = useState(() => initialChoiceOf(descriptor));
  const [isConfiguring, setIsConfiguring] = useState(false);
  const variant = descriptor.variants.find((entry) => entry.id === chosen);

  if (isConfiguring && variant !== undefined) {
    return (
      <ProviderCredentials
        isBusy={isBusy}
        onBack={() => {
          onEdit();
          setIsConfiguring(false);
        }}
        onEdit={onEdit}
        onSave={(values, checkFirst) => onSave(chosen, values, checkFirst)}
        outcome={outcome}
        variant={variant}
        wording={wording}
      />
    );
  }

  return (
    <ProviderChoice
      chosen={chosen}
      descriptor={descriptor}
      isBusy={isBusy}
      isFirstStep={isFirstStep}
      onBack={onBack}
      onChoose={setChosen}
      onContinue={() => setIsConfiguring(true)}
      onSkip={offersSkipButton(descriptor, wording === "setup") ? onSkip : null}
      wording={wording}
    />
  );
};
