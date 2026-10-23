import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  completionFailureOf,
  useInstanceIntegration,
} from "@/features/instance-integration";
import type { SaveOutcome } from "@/features/instance-integration";
import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";

import { useUnsavedChangesWarning } from "../lib/use-unsaved-changes-warning";
import { INTEGRATION_ROWS, integrationRowsOf } from "./integration-rows";
import {
  BANKING_INTEGRATION,
  needsSwitchConfirmation,
} from "./switch-confirmation";

const OFF_VARIANT = "disabled";
const INSTANCE_OWNER = "instance";

interface PendingSave {
  checkFirst: boolean;
  values: Record<string, string>;
  variantId: string;
}

export const useIntegrationSettings = (isShown: boolean) => {
  const queryClient = useQueryClient();
  const [heldId, setHeldId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [outcome, setOutcome] = useState<SaveOutcome | undefined>();
  const [isEdited, setIsEdited] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<PendingSave | null>(null);

  const close = () => {
    setIsOpen(false);
    setIsEdited(false);
    setPendingSwitch(null);
  };

  const instanceIntegration = useInstanceIntegration({
    onApplied: async () => {
      await queryClient.invalidateQueries();
      toast.success(m.settings_integrations_applied_toast());
    },
    onSaveAdvance: close,
  });

  const { check, complete, restartPhase, save } = instanceIntegration;

  const configuration = useQuery(
    orpc.instance.describe.queryOptions({
      enabled: isShown && restartPhase === "idle",
      retry: false,
    })
  );

  const isBankingOpen = isOpen && heldId === BANKING_INTEGRATION;

  const connections = useQuery(
    orpc.instance.bankConnectionCount.queryOptions({
      enabled: isBankingOpen,
      staleTime: 0,
    })
  );

  const connectionCount = connections.isError
    ? undefined
    : (connections.data?.count ?? 0);

  useUnsavedChangesWarning(isOpen && isEdited);

  const integrations = configuration.data?.integrations;
  const opened = integrations?.find((integration) => integration.id === heldId);

  const open = (integrationId: string) => {
    complete.reset();
    setOutcome(undefined);
    setIsEdited(false);
    setHeldId(integrationId);
    setOpenCount((count) => count + 1);
    setIsOpen(true);
  };

  const edit = () => {
    setIsEdited(true);
    setOutcome(undefined);
  };

  const saveValues = (
    integrationId: string,
    variantId: string,
    values: Record<string, string>
  ) =>
    save.mutate(
      { integrationId, values, variantId },
      {
        onSuccess: (saved) => {
          setOutcome(saved);

          if (saved.outcome === "saved") {
            toast.warning(m.setup_saved_unchecked());
          }
        },
      }
    );

  const checkThenSave = (
    integrationId: string,
    variantId: string,
    values: Record<string, string>
  ) =>
    check.mutate(
      { integrationId, values, variantId },
      {
        onSuccess: (checked) => {
          if (checked.outcome !== "verified") {
            setOutcome(checked);

            return;
          }

          save.mutate(
            { integrationId, values, variantId },
            { onSuccess: (saved) => setOutcome({ ...saved, checked: true }) }
          );
        },
      }
    );

  const proceed = (
    integrationId: string,
    { checkFirst, values, variantId }: PendingSave
  ) => {
    if (checkFirst) {
      checkThenSave(integrationId, variantId, values);

      return;
    }

    saveValues(integrationId, variantId, values);
  };

  const submit = (
    variantId: string,
    values: Record<string, string>,
    checkFirst: boolean
  ) => {
    if (opened === undefined) {
      return;
    }

    const pending = { checkFirst, values, variantId };

    if (
      needsSwitchConfirmation({
        chosenVariantId: variantId,
        connectionCount,
        currentVariantId: opened.selectedVariantId,
        integrationId: opened.id,
      })
    ) {
      setPendingSwitch(pending);

      return;
    }

    proceed(opened.id, pending);
  };

  const confirmSwitch = () => {
    if (opened === undefined || pendingSwitch === null) {
      return;
    }

    setPendingSwitch(null);
    proceed(opened.id, pendingSwitch);
  };

  const turnOff = () => {
    if (opened?.configuredBy !== INSTANCE_OWNER) {
      close();

      return;
    }

    save.mutate(
      { integrationId: opened.id, values: {}, variantId: OFF_VARIANT },
      { onSuccess: setOutcome }
    );
  };

  const checkEnvironment = (variantId: string) => {
    if (opened === undefined) {
      return;
    }

    check.mutate(
      { integrationId: opened.id, values: {}, variantId },
      { onSuccess: setOutcome }
    );
  };

  return {
    applyFailure:
      complete.error === null ? null : completionFailureOf(complete.error),
    connectionCount,
    dialogKey: `${heldId ?? ""}-${openCount}`,
    handleApply: () => complete.mutate({}),
    handleCancelSwitch: () => setPendingSwitch(null),
    handleCheckEnvironment: checkEnvironment,
    handleClose: close,
    handleConfigure: open,
    handleConfirmSwitch: confirmSwitch,
    handleEdit: edit,
    handleReconnect: instanceIntegration.reconnect,
    handleRetry: () => configuration.refetch(),
    handleSubmit: submit,
    handleTurnOff: turnOff,
    isApplying: complete.isPending,
    isBusy:
      check.isPending ||
      save.isPending ||
      (isBankingOpen && connections.isFetching),
    isChecking: check.isPending,
    isError: configuration.isError,
    isOpen,
    isPending: configuration.isPending,
    isSwitchPending: pendingSwitch !== null,
    opened,
    outcome,
    restartPhase,
    restartRequired: configuration.data?.restartRequired ?? false,
    rows: integrationRowsOf(INTEGRATION_ROWS, integrations),
  };
};

export type IntegrationSettings = ReturnType<typeof useIntegrationSettings>;
