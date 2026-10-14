import { useState } from "react";

import type { SaveOutcome } from "../model/outcome";
import { ProviderChoice } from "./provider-choice";
import { ProviderCredentials } from "./provider-credentials";
import type { SetupFieldDescriptor } from "./setup-field";

const SKIP_VARIANT = "disabled";

export interface SetupVariantDescriptor {
  fields: SetupFieldDescriptor[];
  id: string;
}

export interface SetupIntegrationDescriptor {
  configuredBy: string | null;
  discriminantKey: string;
  discriminantSource: string;
  id: string;
  selectedVariantId: string;
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
}

const defaultChoiceOf = (descriptor: SetupIntegrationDescriptor): string => {
  if (descriptor.selectedVariantId !== SKIP_VARIANT) {
    return descriptor.selectedVariantId;
  }

  const firstProvider = descriptor.variants.find(
    (variant) => variant.id !== SKIP_VARIANT
  );

  return firstProvider?.id ?? SKIP_VARIANT;
};

export const ProviderStep = ({
  descriptor,
  isBusy,
  isFirstStep,
  onBack,
  onEdit,
  onSave,
  onSkip,
  outcome,
}: ProviderStepProps) => {
  const [chosen, setChosen] = useState(() => defaultChoiceOf(descriptor));
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
      onContinue={() => {
        if (chosen === SKIP_VARIANT) {
          onSkip();

          return;
        }

        setIsConfiguring(true);
      }}
    />
  );
};
