import { Badge } from "@freenary/ui/components/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@freenary/ui/components/item";
import { RiArrowRightSLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { ACCOUNT_TYPE_LABELS, accountName } from "@/entities/account";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { orpc } from "@/shared/api";

import { accountsOf, buildBankRows } from "../model/bank-rows";
import type { BankRow } from "../model/bank-rows";
import { useBankConnections } from "../model/use-bank-connections";
import type { BankInstitution } from "../model/use-bank-connections";
import {
  useDeleteAccounts,
  useDeletingAccountIds,
} from "../model/use-delete-accounts";
import { BankActionsMenu } from "./bank-actions-menu";
import { BankListSkeleton } from "./bank-list-skeleton";
import { ConnectedAccountRow } from "./connected-account-row";

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

const ConnectionAccountRows = ({ accountIds }: { accountIds: string[] }) => {
  const overview = useQuery(orpc.portfolio.getOverview.queryOptions());
  const accounts = (overview.data?.accounts ?? []).filter((account) =>
    accountIds.includes(account.id)
  );

  if (accounts.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-0.5 ps-11 pb-2">
      {accounts.map((account) => (
        <li key={account.id}>
          <Item
            className="hover:bg-muted rounded-md px-2 py-2"
            render={
              <Link
                params={{ accountId: account.id }}
                to="/settings/bank-accounts/$accountId"
              />
            }
            size="xs"
          >
            <ItemContent className="min-w-0">
              <ItemTitle className="flex items-center gap-2">
                {accountName(account)}
                {account.excluded ? (
                  <Badge color="gray" size="compact" variant="dot">
                    {m.settings_bank_account_excluded_badge()}
                  </Badge>
                ) : null}
              </ItemTitle>
              <ItemDescription>
                {account.currency
                  ? m.settings_bank_account_row_meta({
                      currency: account.currency,
                      type: ACCOUNT_TYPE_LABELS[account.type](),
                    })
                  : ACCOUNT_TYPE_LABELS[account.type]()}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <RiArrowRightSLine
                aria-hidden="true"
                className="text-muted-foreground size-4"
              />
            </ItemActions>
          </Item>
        </li>
      ))}
    </ul>
  );
};

export const ConnectedBankList = ({ banks }: ConnectedBankListProps) => {
  const locale = getLocale();
  const {
    connecting,
    connections,
    disconnect,
    disconnectingId,
    isConnectionsMissing,
    isConnectionsPending,
    reconnect,
    resync,
    resyncingId,
  } = useBankConnections({ returnTo: "settings" });

  const deleteAccounts = useDeleteAccounts();
  const deletingIds = useDeletingAccountIds();

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
                <BankActionsMenu
                  connection={row.connection}
                  institutionName={row.name}
                  isDisconnecting={disconnectingId === row.connection.id}
                  isRedirecting={connecting === row.connection.id}
                  isSyncing={resyncingId === row.connection.id}
                  onDisconnect={() => {
                    if (row.connection) {
                      disconnect(row.connection.id);
                    }
                  }}
                  onReconnect={() => {
                    if (row.connection) {
                      void reconnect(row.connection);
                    }
                  }}
                  onSync={() => {
                    if (row.connection) {
                      resync(row.connection);
                    }
                  }}
                />
              </ItemActions>
            )}
          </Item>
          {row.connection ? (
            <ConnectionAccountRows
              accountIds={row.connection.accounts.map((held) => held.id)}
            />
          ) : null}
          {row.connection ? (
            <ul className="flex flex-col gap-1 ps-10.5 pb-2.5">
              {accountsOf(row.connection).flatMap((account) =>
                account.inConsent
                  ? []
                  : [
                      <li key={account.id}>
                        <ConnectedAccountRow
                          account={account}
                          isDeleting={deletingIds.has(account.id)}
                          onDelete={() => deleteAccounts.mutate([account.id])}
                        />
                      </li>,
                    ]
              )}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
};
