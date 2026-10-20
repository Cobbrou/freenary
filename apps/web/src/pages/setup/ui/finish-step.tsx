import { Button } from "@freenary/ui/components/button";
import { Elevated } from "@freenary/ui/lib/elevated";
import { useIcon } from "@freenary/ui/lib/icon-context";
import { RiCheckLine, RiErrorWarningLine } from "@remixicon/react";

import { m } from "@/paraglide/messages.js";
import { remixIcon } from "@/shared/lib/remix-icon";
import { WizardStepHeader } from "@/shared/ui/wizard-step-header";

import { integrationTitle, stateLabel, variantLabel } from "../model/labels";
import type { SetupIntegrationDescriptor } from "./provider-step";

const CONFIGURED_STATE = "configured";
const DISABLED_STATE = "disabled";
const SURFACE_RADIUS = "rounded-xl";
const SURFACE_STEP = 1;
const CHECK_ICON_SIZE = 14;
const ALERT_ICON_SIZE = 20;
const CheckIcon = remixIcon(RiCheckLine);
const AlertIcon = remixIcon(RiErrorWarningLine);

interface StateMarkProps {
  state: string;
}

const StateMark = ({ state }: StateMarkProps) => {
  if (state === CONFIGURED_STATE) {
    return (
      <span
        aria-hidden="true"
        className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full"
      >
        <CheckIcon size={CHECK_ICON_SIZE} />
      </span>
    );
  }

  if (state === DISABLED_STATE) {
    return (
      <span
        aria-hidden="true"
        className="border-muted-foreground/40 size-5 shrink-0 rounded-full border border-dashed"
      />
    );
  }

  return (
    <span aria-hidden="true" className="text-destructive flex shrink-0">
      <AlertIcon size={ALERT_ICON_SIZE} />
    </span>
  );
};

const rowValue = (integration: SetupIntegrationDescriptor): string =>
  integration.state === CONFIGURED_STATE
    ? variantLabel(integration.selectedVariantId)
    : stateLabel(integration.state);

interface FinishStepProps {
  integrations: SetupIntegrationDescriptor[];
  isCompleting: boolean;
  onBack: () => void;
  onFinish: () => void;
}

export const FinishStep = ({
  integrations,
  isCompleting,
  onBack,
  onFinish,
}: FinishStepProps) => {
  const ArrowLeftIcon = useIcon("arrow-left");

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description={m.setup_finish_description()}
        title={m.setup_finish_title()}
      />

      <Elevated className={SURFACE_RADIUS} offset={SURFACE_STEP}>
        <dl className="divide-border flex flex-col divide-y px-4">
          {integrations.map((integration) => (
            <div
              className="flex items-center justify-between gap-3 py-3"
              key={integration.id}
            >
              <dt className="flex items-center gap-3 text-sm">
                <StateMark state={integration.state} />
                {integrationTitle(integration.id)}
                {integration.state === CONFIGURED_STATE ? (
                  <span className="sr-only">
                    {stateLabel(CONFIGURED_STATE)}
                  </span>
                ) : null}
              </dt>
              <dd className="text-muted-foreground text-sm">
                {rowValue(integration)}
              </dd>
            </div>
          ))}
        </dl>
      </Elevated>

      <div className="flex items-center justify-between gap-3">
        <Button
          leadingIcon={ArrowLeftIcon}
          onClick={onBack}
          type="button"
          variant="ghost"
        >
          {m.setup_back()}
        </Button>
        <Button loading={isCompleting} onClick={onFinish} type="button">
          {m.setup_finish_action()}
        </Button>
      </div>
    </div>
  );
};
