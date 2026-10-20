import { Button } from "@freenary/ui/components/button";
import { useIcon } from "@freenary/ui/lib/icon-context";
import { cn } from "@freenary/ui/lib/utils";
import { useId } from "react";

import { m } from "@/paraglide/messages.js";
import { WizardStepHeader } from "@/shared/ui/wizard-step-header";

import {
  integrationDescription,
  integrationTitle,
  variantLabel,
} from "../model/labels";
import type { SetupIntegrationDescriptor } from "./provider-step";

const SKIP_VARIANT = "disabled";

const skipLast = (variantId: string): number =>
  variantId === SKIP_VARIANT ? 1 : 0;

interface ProviderChoiceProps {
  chosen: string;
  descriptor: SetupIntegrationDescriptor;
  isBusy: boolean;
  isFirstStep: boolean;
  onBack: () => void;
  onChoose: (variantId: string) => void;
  onContinue: () => void;
}

export const ProviderChoice = ({
  chosen,
  descriptor,
  isBusy,
  isFirstStep,
  onBack,
  onChoose,
  onContinue,
}: ProviderChoiceProps) => {
  const ArrowLeftIcon = useIcon("arrow-left");
  const groupName = useId();
  const titleId = useId();

  return (
    <div className="flex flex-col gap-6">
      <div id={titleId}>
        <WizardStepHeader
          description={integrationDescription(descriptor.id)}
          title={integrationTitle(descriptor.id)}
        />
      </div>

      <fieldset aria-labelledby={titleId} className="flex flex-col gap-2">
        {descriptor.variants
          .toSorted((first, second) => skipLast(first.id) - skipLast(second.id))
          .map((variant) => {
            const isChosen = variant.id === chosen;

            return (
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-sm ring-1 transition-[box-shadow,background-color] duration-150 ease-out",
                  "has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2",
                  isChosen
                    ? "bg-accent ring-primary"
                    : "ring-border hover:bg-accent/60"
                )}
                key={variant.id}
              >
                <input
                  checked={isChosen}
                  className="accent-primary size-4 shrink-0"
                  name={groupName}
                  onChange={() => onChoose(variant.id)}
                  type="radio"
                  value={variant.id}
                />
                <span className={isChosen ? "font-medium" : undefined}>
                  {variantLabel(variant.id)}
                </span>
              </label>
            );
          })}
      </fieldset>

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
        <Button loading={isBusy} onClick={onContinue} type="button">
          {m.setup_continue()}
        </Button>
      </div>
    </div>
  );
};
