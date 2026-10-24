import { Button } from "@freenary/ui/components/button";
import { Elevated } from "@freenary/ui/lib/elevated";
import { useIcon } from "@freenary/ui/lib/icon-context";
import { cn } from "@freenary/ui/lib/utils";
import { RiCheckLine, RiServerLine } from "@remixicon/react";

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
import type { IntegrationWording } from "../model/wording";
import { ENVIRONMENT_DONE_LABELS } from "../model/wording";
import { OutcomeNotice } from "./outcome-notice";
import type { SetupIntegrationDescriptor } from "./provider-step";
import { ServerValueRow } from "./server-value-row";

const ENVIRONMENT_SOURCE = "environment";
const SURFACE_RADIUS = "rounded-xl";
const SURFACE_STEP = 1;
const READY_ICON_SIZE = 16;
const CheckIcon = remixIcon(RiCheckLine);
const ServerIcon = remixIcon(RiServerLine);

interface EnvironmentSummaryProps {
  descriptor: SetupIntegrationDescriptor;
  isChecking: boolean;
  isFirstStep: boolean;
  onBack: () => void;
  onCheck: (variantId: string) => void;
  onNext: () => void;
  outcome: SaveOutcome | undefined;
  wording?: IntegrationWording;
}

export const EnvironmentSummary = ({
  descriptor,
  isChecking,
  isFirstStep,
  onBack,
  onCheck,
  onNext,
  outcome,
  wording = "setup",
}: EnvironmentSummaryProps) => {
  const ArrowLeftIcon = useIcon("arrow-left");
  const variantId = descriptor.selectedVariantId;
  const provider = variantLabel(variantId);
  const variant = descriptor.variants.find((entry) => entry.id === variantId);
  const fields = variant?.fields ?? [];
  const isVerified = outcome?.outcome === "verified";
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
        description={integrationDescription(descriptor.id, wording)}
        title={integrationTitle(descriptor.id)}
      />

      <Elevated className={SURFACE_RADIUS} offset={SURFACE_STEP}>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                isVerified
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isVerified ? (
                <CheckIcon size={READY_ICON_SIZE} />
              ) : (
                <ServerIcon size={READY_ICON_SIZE} />
              )}
            </span>
            <div className="flex flex-col gap-1">
              <p className="font-medium">
                {isVerified
                  ? m.setup_environment_ready({ provider })
                  : m.setup_environment_configured()}
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
            {ENVIRONMENT_DONE_LABELS[wording]()}
          </Button>
        </div>
      </div>
    </div>
  );
};
