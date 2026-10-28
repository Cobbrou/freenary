import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  completionFailureOf,
  useInstanceIntegration,
} from "@/features/instance-integration";
import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";
import { authClient } from "@/shared/auth";

import { FINISH_STEP, setupStepsOf } from "./setup-steps";

export const useSetup = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const enterApp = async () => {
    await queryClient.invalidateQueries({
      queryKey: orpc.instance.status.queryOptions().queryKey,
    });

    toast.success(m.setup_completed_toast());
    await navigate({ to: "/" });
  };

  const advanceRef = useRef<(() => void) | null>(null);

  const instanceIntegration = useInstanceIntegration({
    onApplied: enterApp,
    onSaveAdvance: () => {
      advanceRef.current?.();
    },
  });

  const { restartPhase } = instanceIntegration;

  const [chosenStep, setChosenStep] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);

  const status = useQuery(orpc.instance.status.queryOptions());
  const isOperator = status.data?.isOperator ?? false;
  const isUnclaimed = status.data?.claimed === false;

  const claim = useMutation(
    orpc.instance.claim.mutationOptions({
      onSuccess: async ({ outcome }) => {
        if (outcome !== "refused") {
          await status.refetch();
        }
      },
    })
  );

  const claimError = () => {
    if (claim.isError) {
      return m.setup_claim_failed();
    }

    return claim.data?.outcome === "refused" ? m.setup_claim_refused() : null;
  };

  const configuration = useQuery(
    orpc.instance.describe.queryOptions({
      enabled: isOperator && restartPhase === "idle",
      retry: false,
    })
  );

  const loadFailed = status.isError || configuration.isError;

  const retryLoad = async () => {
    await (status.isError ? status.refetch() : configuration.refetch());
  };

  const steps = setupStepsOf(configuration.data?.integrations ?? []);

  const stepId = chosenStep ?? steps[0] ?? FINISH_STEP;
  const stepIndex = Math.max(steps.indexOf(stepId), 0);

  const goTo = (next: string, heading: 1 | -1) => {
    instanceIntegration.complete.reset();
    setDirection(heading);
    setChosenStep(next);
  };

  const completeError = instanceIntegration.complete.error;
  const completionFailure =
    completeError === null ? null : completionFailureOf(completeError);

  const handleSignOut = async () => {
    await authClient.signOut();
    await navigate({ to: "/login" });
  };

  const handleNext = () => {
    const next = steps[stepIndex + 1];

    if (next !== undefined) {
      goTo(next, 1);
    }
  };

  useEffect(() => {
    advanceRef.current = handleNext;
  });

  const handleBack = () => {
    const previous = steps[stepIndex - 1];

    if (previous !== undefined) {
      goTo(previous, -1);
    }
  };

  return {
    check: instanceIntegration.check,
    claim,
    claimError: claimError(),
    complete: instanceIntegration.complete,
    completionFailure,
    configuration,
    direction,
    handleBack,
    handleNext,
    handleSignOut,
    isOperator,
    isPending: status.isPending || (isOperator && configuration.isPending),
    isUnclaimed,
    loadFailed,
    reconnect: instanceIntegration.reconnect,
    restartPhase,
    retryLoad,
    save: instanceIntegration.save,
    stepId,
    stepIndex,
    steps,
  };
};
