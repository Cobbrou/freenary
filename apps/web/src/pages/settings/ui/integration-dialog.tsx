import { Dialog, DialogContent } from "@freenary/ui/components/dialog";
import { cn } from "@freenary/ui/lib/utils";
import { useState } from "react";

import {
  EnvironmentSummary,
  integrationTitle,
  ProviderStep,
  variantLabel,
} from "@/features/instance-integration";
import type {
  SaveOutcome,
  SetupIntegrationDescriptor,
} from "@/features/instance-integration";

import { SwitchProviderDialog } from "./switch-provider-dialog";
import { TurnOffDialog } from "./turn-off-dialog";

const ENVIRONMENT_OWNER = "environment";

const TALLER_THAN_A_SHORT_VIEWPORT =
  "max-h-[calc(100dvh-4rem)] overflow-y-auto";

const TITLE_CLEARS_CLOSE_BUTTON = "[&_h1]:pe-8";

interface IntegrationDialogProps {
  connectionCount: number | undefined;
  integration: SetupIntegrationDescriptor | undefined;
  isBusy: boolean;
  isChecking: boolean;
  isOpen: boolean;
  isSwitchPending: boolean;
  onCancelSwitch: () => void;
  onCheckEnvironment: (variantId: string) => void;
  onClose: () => void;
  onConfirmSwitch: () => void;
  onEdit: () => void;
  onSave: (
    variantId: string,
    values: Record<string, string>,
    checkFirst: boolean
  ) => void;
  onTurnOff: () => void;
  outcome: SaveOutcome | undefined;
  stepKey: string;
}

export const IntegrationDialog = ({
  connectionCount,
  integration,
  isBusy,
  isChecking,
  isOpen,
  isSwitchPending,
  onCancelSwitch,
  onCheckEnvironment,
  onClose,
  onConfirmSwitch,
  onEdit,
  onSave,
  onTurnOff,
  outcome,
  stepKey,
}: IntegrationDialogProps) => {
  const [isTurnOffPending, setIsTurnOffPending] = useState(false);

  const renderStep = (descriptor: SetupIntegrationDescriptor) => {
    if (descriptor.configuredBy === ENVIRONMENT_OWNER) {
      return (
        <EnvironmentSummary
          descriptor={descriptor}
          isChecking={isChecking}
          isFirstStep
          key={stepKey}
          onBack={onClose}
          onCheck={onCheckEnvironment}
          onNext={onClose}
          outcome={outcome}
          wording="settings"
        />
      );
    }

    return (
      <ProviderStep
        descriptor={descriptor}
        isBusy={isBusy}
        isFirstStep
        key={stepKey}
        onBack={onClose}
        onEdit={onEdit}
        onSave={onSave}
        onSkip={() => setIsTurnOffPending(true)}
        outcome={outcome}
        wording="settings"
      />
    );
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      open={isOpen}
    >
      <DialogContent
        aria-label={
          integration === undefined
            ? undefined
            : integrationTitle(integration.id)
        }
        className={cn(TALLER_THAN_A_SHORT_VIEWPORT, TITLE_CLEARS_CLOSE_BUTTON)}
        size="lg"
      >
        {integration === undefined ? null : renderStep(integration)}
        <SwitchProviderDialog
          connectionCount={connectionCount}
          isOpen={isSwitchPending}
          onCancel={onCancelSwitch}
          onConfirm={onConfirmSwitch}
        />
        <TurnOffDialog
          isOpen={isTurnOffPending}
          onCancel={() => setIsTurnOffPending(false)}
          onConfirm={() => {
            setIsTurnOffPending(false);
            onTurnOff();
          }}
          provider={
            integration === undefined
              ? ""
              : variantLabel(integration.selectedVariantId)
          }
        />
      </DialogContent>
    </Dialog>
  );
};
