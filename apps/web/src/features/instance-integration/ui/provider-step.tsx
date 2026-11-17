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
  chosen?: string;
  descriptor: SetupIntegrationDescriptor;
  isBusy: boolean;
  isConfiguring?: boolean;
  isFirstStep: boolean;
  onBack: () => void;
  onCheck?: (variantId: string, values: Record<string, string>) => void;
  onChoose?: (variantId: string) => void;
  onConfiguringChange?: (isConfiguring: boolean) => void;
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
  chosen: controlledChoice,
  descriptor,
  isBusy,
  isConfiguring: controlledIsConfiguring,
  isFirstStep,
  onBack,
  onCheck,
  onChoose,
  onConfiguringChange,
  onEdit,
  onSave,
  onSkip,
  outcome,
  wording = "setup",
}: ProviderStepProps) => {
  const [ownChoice, setOwnChoice] = useState(() => initialChoiceOf(descriptor));
  const [ownIsConfiguring, setOwnIsConfiguring] = useState(false);
  const isConfiguring = controlledIsConfiguring ?? ownIsConfiguring;
  const chosen = controlledChoice ?? ownChoice;
  const variant = descriptor.variants.find((entry) => entry.id === chosen);

  const setConfiguring = (next: boolean) => {
    setOwnIsConfiguring(next);
    onConfiguringChange?.(next);
  };

  const choose = (variantId: string) => {
    setOwnChoice(variantId);
    onChoose?.(variantId);
  };

  if (isConfiguring && variant !== undefined) {
    return (
      <ProviderCredentials
        isBusy={isBusy}
        onBack={() => {
          onEdit();
          setConfiguring(false);
        }}
        onCheck={
          onCheck === undefined
            ? undefined
            : (values) => onCheck(chosen, values)
        }
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
      onChoose={choose}
      onContinue={() => setConfiguring(true)}
      onSkip={offersSkipButton(descriptor, wording === "setup") ? onSkip : null}
      wording={wording}
    />
  );
};
