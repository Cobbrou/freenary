import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@freenary/ui/components/item";
import { useMemo } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { SyncButton } from "@/shared/ui/sync-button";

import { buildBankRows } from "../model/bank-rows";
import type { BankRow } from "../model/bank-rows";
import { useBankConnections } from "../model/use-bank-connections";
import type { BankInstitution } from "../model/use-bank-connections";
import { BankListSkeleton } from "./bank-list-skeleton";
import { DisconnectBankDialog } from "./disconnect-bank-dialog";

interface ConnectedBankListProps {
  banks: BankInstitution[];
}

const initialOf = (name: string): string =>
  name.trim().charAt(0).toLocaleUpperCase(getLocale());

const BankMark = ({ row }: { row: BankRow }) =>
  row.logo ? (
    <img alt="" src={row.logo} />
  ) : (
    <span
      aria-hidden="true"
      className="bg-muted text-muted-foreground flex size-full items-center justify-center text-sm font-medium"
    >
      {initialOf(row.name)}
    </span>
  );

export const ConnectedBankList = ({ banks }: ConnectedBankListProps) => {
  const locale = getLocale();
  const {
    connections,
    disconnect,
    disconnectingId,
    isConnectionsMissing,
    isConnectionsPending,
    resync,
    resyncingId,
  } = useBankConnections({ returnTo: "settings" });

  const rows = useMemo(
    () =>
      buildBankRows(banks, connections, locale).filter(
        (row) => row.connection !== null
      ),
    [banks, connections, locale]
  );

  if (isConnectionsPending) {
    return (
      <div aria-busy="true">
        <output className="sr-only">
          {m.settings_bank_accounts_loading()}
        </output>
        <div aria-hidden="true">
          <BankListSkeleton rows={2} />
        </div>
      </div>
    );
  }

  if (isConnectionsMissing) {
    return (
      <p className="text-destructive px-3 py-2.5 text-sm" role="alert">
        {m.bank_connections_error_title()} {m.bank_error_retry_description()}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground px-3 py-2.5 text-sm">
        {m.settings_bank_accounts_empty()}
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li className="border-border not-first:border-t" key={row.id}>
          <Item size="sm">
            <ItemMedia className="[&_img]:object-contain" variant="image">
              <BankMark row={row} />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="block w-full break-words">
                {row.name}
              </ItemTitle>
              {row.description ? (
                <ItemDescription className="line-clamp-none">
                  {row.description}
                </ItemDescription>
              ) : null}
            </ItemContent>
            {row.connection === null ? null : (
              <ItemActions>
                <SyncButton
                  isSyncing={resyncingId === row.connection.id}
                  label={m.bank_row_sync({ institution: row.name })}
                  onSync={() => {
                    if (row.connection) {
                      resync(row.connection);
                    }
                  }}
                  size="icon-compact"
                />
                <DisconnectBankDialog
                  accountCount={row.connection.accounts.length}
                  institutionName={row.name}
                  isDisconnecting={disconnectingId === row.connection.id}
                  onConfirm={() => {
                    if (row.connection) {
                      disconnect(row.connection.id);
                    }
                  }}
                />
              </ItemActions>
            )}
          </Item>
        </li>
      ))}
    </ul>
  );
};
