import type { AppRouter } from "@freenary/api/routers/index";
import type { InferRouterOutputs } from "@orpc/server";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";
import { client, invalidateBudgetData, orpc } from "@/shared/api";

import { institutionKey } from "./bank-rows";

export type BankConnection =
  InferRouterOutputs<AppRouter>["bankConnection"]["listConnections"]["connections"][number];

export type BankInstitution =
  InferRouterOutputs<AppRouter>["bankConnection"]["listInstitutions"]["banks"][number];

export type BankConnectionReturnTo = "onboarding" | "settings";

const EMPTY_CONNECTIONS: BankConnection[] = [];

export const useBankConnections = ({
  returnTo,
}: {
  returnTo: BankConnectionReturnTo;
}) => {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState<string | null>(null);

  const connectionsQuery = useQuery(
    orpc.bankConnection.listConnections.queryOptions()
  );

  const disconnectMutation = useMutation({
    mutationFn: (connectionId: string) =>
      client.bankConnection.disconnect({ connectionId }),
    onError: (error) => {
      toast.error(error.message);
    },
    onSuccess: async ({
      accountsRemoved,
      institutionName,
      revocationRequested,
    }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.bankConnection.listConnections.queryOptions().queryKey,
        }),
        invalidateBudgetData(queryClient),
      ]);

      if (!revocationRequested) {
        toast.warning(
          m.bank_disconnect_revoke_warning({ institution: institutionName })
        );

        return;
      }

      if (accountsRemoved === 0) {
        toast.success(
          m.bank_disconnect_success({ institution: institutionName })
        );

        return;
      }

      toast.success(
        m.bank_disconnect_success_accounts({
          count: accountsRemoved,
          institution: institutionName,
        })
      );
    },
  });

  const resyncMutation = useMutation({
    mutationFn: (connection: BankConnection) =>
      client.budget.syncAccounts({ connectionId: connection.id, force: true }),
    onError: () => {
      toast.error(m.budget_sync_error());
    },
    onSuccess: async (sync, connection) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.bankConnection.listConnections.queryOptions().queryKey,
        }),
        invalidateBudgetData(queryClient),
      ]);

      if (!sync.success) {
        toast.error(m.budget_sync_error());

        return;
      }

      toast.success(
        m.bank_sync_success({ institution: connection.institutionName })
      );
    },
  });

  const handOverToBank = async (bank: BankInstitution) => {
    setConnecting(institutionKey(bank));
    const started = await client.bankConnection
      .startConnection({
        bankCountry: bank.country,
        institutionId: bank.id,
        returnTo,
        state: crypto.randomUUID(),
      })
      .catch(() => null);

    if (started?.url) {
      window.location.assign(started.url);

      return;
    }

    toast.error(m.bank_connect_error({ institution: bank.name }));
    setConnecting(null);
  };

  const connections = connectionsQuery.data?.connections ?? EMPTY_CONNECTIONS;

  return {
    connect: handOverToBank,
    connecting,
    connections,
    disconnect: disconnectMutation.mutate,
    disconnectingId: disconnectMutation.isPending
      ? disconnectMutation.variables
      : null,
    isConnectionsMissing:
      connectionsQuery.isError && connectionsQuery.data === undefined,
    isConnectionsPending: connectionsQuery.isPending,
    resync: resyncMutation.mutate,
    resyncingId: resyncMutation.isPending ? resyncMutation.variables.id : null,
  };
};
