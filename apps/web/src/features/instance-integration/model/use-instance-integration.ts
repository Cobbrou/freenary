import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { orpc } from "@/shared/api";

import { waitForAppliedServer } from "../api/wait-for-server";

const ADVANCING_OUTCOMES: ReadonlySet<string> = new Set([
  "saved",
  "nothing-to-save",
]);

interface InstanceIntegrationOptions {
  onApplied: () => Promise<void>;
  onSaveAdvance: () => void;
}

export const useInstanceIntegration = ({
  onApplied,
  onSaveAdvance,
}: InstanceIntegrationOptions) => {
  const queryClient = useQueryClient();
  const [restartPhase, setRestartPhase] = useState<
    "idle" | "reconnecting" | "stalled"
  >("idle");

  const refreshConfiguration = async () => {
    await queryClient.invalidateQueries({
      queryKey: orpc.instance.describe.queryOptions().queryKey,
    });
  };

  const save = useMutation(
    orpc.instance.save.mutationOptions({
      onSuccess: async (outcome) => {
        if (outcome.outcome === "saved") {
          await refreshConfiguration();
        }

        if (ADVANCING_OUTCOMES.has(outcome.outcome)) {
          onSaveAdvance();
        }
      },
    })
  );

  const check = useMutation(orpc.instance.check.mutationOptions());

  const reconnect = async () => {
    setRestartPhase("reconnecting");

    const isBack = await waitForAppliedServer();

    if (!isBack) {
      setRestartPhase("stalled");

      return;
    }

    await refreshConfiguration();
    await onApplied();
  };

  const complete = useMutation(
    orpc.instance.complete.mutationOptions({
      onSuccess: async ({ restarting }) => {
        if (restarting) {
          await reconnect();

          return;
        }

        await onApplied();
      },
    })
  );

  return {
    check,
    complete,
    reconnect,
    restartPhase,
    save,
  };
};
