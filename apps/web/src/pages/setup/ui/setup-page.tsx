import { Button } from "@freenary/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyTitle,
} from "@freenary/ui/components/empty";
import { Spinner } from "@freenary/ui/components/spinner";
import { useState } from "react";
import { toast } from "sonner";

import {
  EnvironmentSummary,
  initialChoiceOf,
  isFailedOutcome,
  ProviderStep,
  restartDocsUrl,
} from "@/features/instance-integration";
import type { SaveOutcome } from "@/features/instance-integration";
import { m } from "@/paraglide/messages.js";
import { WizardShell, WizardStepper } from "@/shared/ui/wizard";

import { setupAvatarState } from "../model/avatar-state";
import { completionFailureMessage, stepLabel } from "../model/labels";
import { FINISH_STEP, setupIntegrationsOf } from "../model/setup-steps";
import { useSetup } from "../model/use-setup";
import { ClaimStep } from "./claim-step";
import { FaultNotice } from "./fault-notice";
import { FinishStep } from "./finish-step";
import { SetupWizardSkeleton } from "./setup-wizard-skeleton";

const SKIP_VARIANT = "disabled";

export const SetupPage = () => {
  const setup = useSetup();
  const [outcomes, setOutcomes] = useState<Record<string, SaveOutcome>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const described = setup.configuration.data;
  const integrations = described?.integrations ?? [];
  const fault = described?.fault ?? null;
  const stepLabels = setup.steps.map((id) => () => stepLabel(id));

  const stepper = (
    <WizardStepper
      current={setup.stepIndex}
      label={m.setup_progress_label()}
      steps={stepLabels}
    />
  );

  const activeIntegration = integrations.find(
    (integration) => integration.id === setup.stepId
  );

  const body = () => {
    if (setup.restartPhase === "reconnecting") {
      return (
        <Empty>
          <Spinner />
          <EmptyTitle>{m.setup_applying_title()}</EmptyTitle>
          <EmptyDescription>{m.setup_applying_description()}</EmptyDescription>
        </Empty>
      );
    }

    if (setup.restartPhase === "stalled") {
      return (
        <Empty>
          <EmptyTitle>{m.setup_stalled_title()}</EmptyTitle>
          <EmptyDescription>{m.setup_stalled_description()}</EmptyDescription>
          <div className="flex items-center gap-3">
            <Button onClick={() => setup.reconnect()} type="button">
              {m.setup_try_again()}
            </Button>
            <a
              className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-2"
              href={restartDocsUrl()}
              rel="noopener noreferrer"
              target="_blank"
            >
              {m.setup_view_troubleshooting()}
            </a>
          </div>
        </Empty>
      );
    }

    if (setup.loadFailed) {
      return (
        <Empty>
          <EmptyTitle>{m.setup_load_failed_title()}</EmptyTitle>
          <EmptyDescription>
            {m.setup_load_failed_description()}
          </EmptyDescription>
          <Button onClick={() => setup.retryLoad()} type="button">
            {m.setup_try_again()}
          </Button>
        </Empty>
      );
    }

    if (!setup.isOperator && setup.isUnclaimed) {
      return (
        <ClaimStep
          error={setup.claimError}
          isClaiming={setup.claim.isPending}
          onClaim={(token) => setup.claim.mutate({ token })}
          tokenRequired={setup.setupTokenRequired}
        />
      );
    }

    if (!setup.isOperator) {
      return (
        <Empty>
          <EmptyTitle>{m.setup_not_operator_title()}</EmptyTitle>
          <EmptyDescription>
            {m.setup_not_operator_description()}
          </EmptyDescription>
        </Empty>
      );
    }

    if (setup.stepId === FINISH_STEP) {
      return (
        <FinishStep
          error={
            setup.completionFailure === null
              ? null
              : completionFailureMessage(setup.completionFailure)
          }
          integrations={setupIntegrationsOf(integrations)}
          isCompleting={setup.complete.isPending}
          onBack={setup.handleBack}
          onFinish={() => setup.complete.mutate({})}
        />
      );
    }

    if (activeIntegration === undefined) {
      return null;
    }

    const integrationId = activeIntegration.id;

    const recordOutcome = (outcome: SaveOutcome) =>
      setOutcomes((held) => ({ ...held, [integrationId]: outcome }));

    const clearOutcome = () => {
      setOutcomes((held) =>
        held[integrationId] === undefined
          ? held
          : Object.fromEntries(
              Object.entries(held).filter(([id]) => id !== integrationId)
            )
      );
    };

    if (activeIntegration.configuredBy === "environment") {
      return (
        <EnvironmentSummary
          descriptor={activeIntegration}
          isChecking={setup.check.isPending}
          isFirstStep={setup.stepIndex === 0}
          onBack={setup.handleBack}
          onCheck={(variantId) =>
            setup.check.mutate(
              { integrationId, values: {}, variantId },
              { onSuccess: recordOutcome }
            )
          }
          onNext={setup.handleNext}
          outcome={outcomes[integrationId]}
        />
      );
    }

    const saveValues = (variantId: string, values: Record<string, string>) =>
      setup.save.mutate(
        { integrationId, values, variantId },
        {
          onSuccess: (outcome) => {
            recordOutcome(outcome);

            if (outcome.outcome === "saved") {
              toast.warning(m.setup_saved_unchecked());
            }
          },
        }
      );

    const checkThenSave = (variantId: string, values: Record<string, string>) =>
      setup.check.mutate(
        { integrationId, values, variantId },
        {
          onSuccess: (outcome) => {
            recordOutcome(outcome);

            if (outcome.outcome !== "verified") {
              return;
            }

            setup.save.mutate(
              { integrationId, values, variantId },
              {
                onSuccess: (saved) =>
                  recordOutcome({ ...saved, checked: true }),
              }
            );
          },
        }
      );

    return (
      <ProviderStep
        chosen={choices[integrationId] ?? initialChoiceOf(activeIntegration)}
        descriptor={activeIntegration}
        isBusy={setup.check.isPending || setup.save.isPending}
        isConfiguring={setup.isConfiguring}
        isFirstStep={setup.stepIndex === 0}
        onBack={setup.handleBack}
        onCheck={(variantId, values) =>
          setup.check.mutate(
            { integrationId, values, variantId },
            { onSuccess: recordOutcome }
          )
        }
        onChoose={(variantId) => {
          clearOutcome();
          setChoices((held) =>
            held[integrationId] === variantId
              ? held
              : { ...held, [integrationId]: variantId }
          );
        }}
        onConfiguringChange={(next) =>
          next ? setup.handleConfigure() : setup.handleLeaveConfigure()
        }
        onEdit={clearOutcome}
        onSave={(variantId, values, checkFirst) =>
          checkFirst
            ? checkThenSave(variantId, values)
            : saveValues(variantId, values)
        }
        onSkip={() =>
          activeIntegration.configuredBy === "instance"
            ? setup.save.mutate({
                integrationId,
                values: {},
                variantId: SKIP_VARIANT,
              })
            : setup.handleNext()
        }
        outcome={outcomes[integrationId]}
      />
    );
  };

  const integrationPhase = setup.isConfiguring ? "credentials" : "choose";
  const phaseKey =
    setup.restartPhase === "idle" ? integrationPhase : setup.restartPhase;

  return (
    <WizardShell
      avatarState={setupAvatarState({
        hasCompletionFailure: setup.completionFailure !== null,
        hasFailedOutcome: isFailedOutcome(outcomes[setup.stepId]),
        hasOutcome: outcomes[setup.stepId] !== undefined,
        isBusy:
          setup.check.isPending ||
          setup.save.isPending ||
          setup.complete.isPending,
        restartPhase: setup.restartPhase,
      })}
      direction={setup.direction}
      isPending={setup.isPending}
      skeleton={<SetupWizardSkeleton />}
      stepKey={`${setup.stepId}:${phaseKey}`}
      stepper={setup.isOperator && !setup.loadFailed ? stepper : null}
      toolbar={
        <Button onClick={setup.handleSignOut} type="button" variant="ghost">
          {m.account_sign_out()}
        </Button>
      }
    >
      {fault === null ? (
        body()
      ) : (
        <div className="flex flex-col gap-6">
          <FaultNotice detail={fault} />
          {body()}
        </div>
      )}
    </WizardShell>
  );
};
