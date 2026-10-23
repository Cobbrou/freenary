import { useState } from "react";

import type { SaveOutcome } from "../model/outcome";
import type { IntegrationWording } from "../model/wording";
import { ProviderChoice } from "./provider-choice";
import { ProviderCredentials } from "./provider-credentials";
import type { SetupFieldDescriptor } from "./setup-field";

const SKIP_VARIANT = "disabled";

const OFF_UNTIL_CHOSEN: ReadonlySet<string> = new Set(["assistant"]);

export interface SetupVariantDescriptor {
  fields: SetupFieldDescriptor[];
  id: string;
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

const defaultChoiceOf = (descriptor: SetupIntegrationDescriptor): string => {
  if (descriptor.selectedVariantId !== SKIP_VARIANT) {
    return descriptor.selectedVariantId;
  }

  if (OFF_UNTIL_CHOSEN.has(descriptor.id)) {
    return SKIP_VARIANT;
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
  wording = "setup",
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
      onContinue={() => {
        if (chosen === SKIP_VARIANT) {
          onSkip();

          return;
        }

        setIsConfiguring(true);
      }}
      wording={wording}
    />
  );
};
