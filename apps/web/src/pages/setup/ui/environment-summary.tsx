import { Button } from "@freenary/ui/components/button";
import { Elevated } from "@freenary/ui/lib/elevated";
import { useIcon } from "@freenary/ui/lib/icon-context";
import { RiCheckLine } from "@remixicon/react";

import { m } from "@/paraglide/messages.js";
import { remixIcon } from "@/shared/lib/remix-icon";
import { WizardStepHeader } from "@/shared/ui/wizard-step-header";

import {
  environmentDocsUrl,
  integrationDescription,
  integrationTitle,
  variantLabel,
} from "../model/labels";
import type { SaveOutcome } from "../model/outcome";
import { OutcomeNotice } from "./outcome-notice";
import type { SetupIntegrationDescriptor } from "./provider-step";
import { ServerValueRow } from "./server-value-row";

const ENVIRONMENT_SOURCE = "environment";
const SURFACE_RADIUS = "rounded-xl";
const SURFACE_STEP = 1;
const READY_ICON_SIZE = 16;
const CheckIcon = remixIcon(RiCheckLine);

interface EnvironmentSummaryProps {
  descriptor: SetupIntegrationDescriptor;
  isChecking: boolean;
  isFirstStep: boolean;
  onBack: () => void;
  onCheck: (variantId: string) => void;
  onNext: () => void;
  outcome: SaveOutcome | undefined;
}

export const EnvironmentSummary = ({
  descriptor,
  isChecking,
  isFirstStep,
  onBack,
  onCheck,
  onNext,
  outcome,
}: EnvironmentSummaryProps) => {
  const ArrowLeftIcon = useIcon("arrow-left");
  const variantId = descriptor.selectedVariantId;
  const provider = variantLabel(variantId);
  const variant = descriptor.variants.find((entry) => entry.id === variantId);
  const fields = variant?.fields ?? [];
  const providerIsDefault =
    descriptor.discriminantSource !== ENVIRONMENT_SOURCE;

  const environmentKeys = [
    ...(providerIsDefault ? [] : [descriptor.discriminantKey]),
    ...fields.flatMap((field) =>
      field.source === ENVIRONMENT_SOURCE ? [field.key] : []
    ),
  ];

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description={integrationDescription(descriptor.id)}
        title={integrationTitle(descriptor.id)}
      />

      <Elevated className={SURFACE_RADIUS} offset={SURFACE_STEP}>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <span className="bg-primary text-primary-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
              <CheckIcon size={READY_ICON_SIZE} />
            </span>
            <div className="flex flex-col gap-1">
              <p className="font-medium">
                {m.setup_environment_ready({ provider })}
              </p>
              <p className="text-muted-foreground text-sm">
                {m.setup_environment_line()}{" "}
                <a
                  className="text-foreground underline underline-offset-2"
                  href={environmentDocsUrl()}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {m.setup_environment_learn_more()}
                </a>
              </p>
            </div>
          </div>

          <details className="ps-9">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm select-none">
              {m.setup_show_details()}
            </summary>
            <dl className="divide-border mt-2 flex flex-col divide-y">
              {fields.map((field) => (
                <ServerValueRow
                  descriptor={field}
                  key={field.key}
                  showsSource={false}
                />
              ))}
            </dl>
            <p className="text-muted-foreground mt-2 font-mono text-xs break-words">
              {m.setup_environment_variables({
                keys: environmentKeys.join(", "),
              })}
            </p>
            {providerIsDefault ? (
              <p className="text-muted-foreground mt-1 text-xs">
                {m.setup_environment_default_provider({
                  key: descriptor.discriminantKey,
                  provider,
                })}
              </p>
            ) : null}
          </details>
        </div>
      </Elevated>

      <OutcomeNotice outcome={outcome} provider={provider} />

      <div className="flex items-center justify-between gap-3">
        {isFirstStep ? (
          <span />
        ) : (
          <Button
            leadingIcon={ArrowLeftIcon}
            onClick={onBack}
            type="button"
            variant="ghost"
          >
            {m.setup_back()}
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Button
            loading={isChecking}
            onClick={() => onCheck(variantId)}
            type="button"
            variant="ghost"
          >
            {m.setup_test_connection()}
          </Button>
          <Button onClick={onNext} type="button">
            {m.setup_continue()}
          </Button>
        </div>
      </div>
    </div>
  );
};
