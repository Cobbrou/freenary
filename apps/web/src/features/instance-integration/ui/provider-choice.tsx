import { Badge } from "@freenary/ui/components/badge";
import { Button } from "@freenary/ui/components/button";
import { useIcon } from "@freenary/ui/lib/icon-context";
import { cn } from "@freenary/ui/lib/utils";
import { useId } from "react";

import { m } from "@/paraglide/messages.js";
import { WizardStepHeader } from "@/shared/ui/wizard-step-header";

import {
  integrationDescription,
  integrationTitle,
  variantDescription,
  variantLabel,
} from "../model/labels";
import { choosableVariants } from "../model/variant-choice";
import type { IntegrationWording } from "../model/wording";
import { SKIP_LABELS } from "../model/wording";
import type { SetupIntegrationDescriptor } from "./provider-step";

const SKIP_VARIANT = "disabled";

interface ProviderChoiceProps {
  chosen: string;
  descriptor: SetupIntegrationDescriptor;
  isBusy: boolean;
  isFirstStep: boolean;
  onBack: () => void;
  onChoose: (variantId: string) => void;
  onContinue: () => void;
  onSkip: (() => void) | null;
  wording: IntegrationWording;
}

export const ProviderChoice = ({
  chosen,
  descriptor,
  isBusy,
  isFirstStep,
  onBack,
  onChoose,
  onContinue,
  onSkip,
  wording,
}: ProviderChoiceProps) => {
  const ArrowLeftIcon = useIcon("arrow-left");
  const groupName = useId();
  const titleId = useId();
  const skipNoteId = useId();
  const skipNote =
    wording === "setup"
      ? variantDescription(descriptor.id, SKIP_VARIANT)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div id={titleId}>
        <WizardStepHeader
          description={integrationDescription(descriptor.id, wording)}
          title={integrationTitle(descriptor.id)}
        />
      </div>

      <fieldset aria-labelledby={titleId} className="flex flex-col gap-2">
        {choosableVariants(descriptor).map((variant) => {
          const isChosen = variant.id === chosen;
          const description = variantDescription(descriptor.id, variant.id);

          return (
            <label
              className={cn(
                "flex cursor-pointer gap-3 rounded-xl px-4 py-3 text-sm ring-1 transition-[box-shadow,background-color] duration-150 ease-out",
                description === null ? "items-center" : "items-start",
                "has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2",
                isChosen
                  ? "bg-accent ring-primary"
                  : "ring-border hover:bg-accent/60"
              )}
              key={variant.id}
            >
              <input
                checked={isChosen}
                className={cn(
                  "accent-primary size-4 shrink-0",
                  description === null ? undefined : "mt-0.5"
                )}
                name={groupName}
                onChange={() => onChoose(variant.id)}
                type="radio"
                value={variant.id}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={isChosen ? "font-medium" : undefined}>
                  {variantLabel(variant.id)}
                  {variant.recommended ? (
                    <Badge className="ms-2" size="compact">
                      {m.setup_variant_recommended()}
                    </Badge>
                  ) : null}
                  {variant.legacy ? (
                    <Badge className="ms-2" size="compact" variant="dot">
                      {m.setup_variant_legacy()}
                    </Badge>
                  ) : null}
                </span>
                {description === null ? null : (
                  <span className="text-muted-foreground text-xs">
                    {description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>

      {onSkip === null || skipNote === null ? null : (
        <p className="text-muted-foreground text-sm" id={skipNoteId}>
          {skipNote}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="ms-auto flex items-center gap-2 whitespace-nowrap">
          {onSkip === null ? null : (
            <Button
              aria-describedby={skipNote === null ? undefined : skipNoteId}
              disabled={isBusy}
              onClick={onSkip}
              type="button"
              variant="secondary"
            >
              {SKIP_LABELS[wording]()}
            </Button>
          )}
          <Button loading={isBusy} onClick={onContinue} type="button">
            {m.setup_continue()}
          </Button>
        </div>
      </div>
    </div>
  );
};
