import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@freenary/ui/components/empty";
import { RiErrorWarningLine } from "@remixicon/react";
import { useMemo, useState } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { SearchInput } from "@/shared/ui/search-input";

import { buildBankRows } from "../model/bank-rows";
import { useBankConnections } from "../model/use-bank-connections";
import type {
  BankConnectionReturnTo,
  BankInstitution,
} from "../model/use-bank-connections";
import { BankList } from "./bank-list";

interface BankConnectionPanelProps {
  banks: BankInstitution[];
  isBanksError: boolean;
  isBanksPending: boolean;
  returnTo: BankConnectionReturnTo;
}

export const BankConnectionPanel = ({
  banks,
  isBanksError,
  isBanksPending,
  returnTo,
}: BankConnectionPanelProps) => {
  const [search, setSearch] = useState("");
  const locale = getLocale();
  const {
    connect,
    connecting,
    connections,
    disconnect,
    disconnectingId,
    isConnectionsMissing,
    isConnectionsPending,
    reconnect,
    resync,
    resyncingId,
  } = useBankConnections({ returnTo });

  const rows = useMemo(
    () => buildBankRows(banks, connections, locale),
    [banks, connections, locale]
  );

  const matchingRows = useMemo(() => {
    if (!search.trim()) {
      return rows;
    }

    const query = search.toLowerCase();

    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        row.institution?.bic?.toLowerCase().includes(query)
    );
  }, [rows, search]);

  if (isConnectionsMissing) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiErrorWarningLine />
          </EmptyMedia>
          <EmptyTitle>{m.bank_connections_error_title()}</EmptyTitle>
          <EmptyDescription>
            {m.bank_error_retry_description()}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const hasNoInstitutionsAtAll = banks.length === 0;

  return (
    <div className="flex flex-col gap-2.5">
      <SearchInput
        onChange={setSearch}
        placeholder={m.bank_search_placeholder()}
        value={search}
      />
      <BankList
        connecting={connecting}
        disconnectingId={disconnectingId}
        hasSearch={search.length > 0}
        isError={isBanksError && hasNoInstitutionsAtAll}
        isPending={isBanksPending || isConnectionsPending}
        onConnect={(row) => {
          if (row.institution) {
            void connect(row.institution);
          }
        }}
        onDisconnect={disconnect}
        onReconnect={(connection) => {
          void reconnect(connection);
        }}
        onSync={resync}
        rows={matchingRows}
        syncingId={resyncingId}
      />
    </div>
  );
};
