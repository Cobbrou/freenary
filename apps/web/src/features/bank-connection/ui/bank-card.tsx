import { Button } from "@freenary/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@freenary/ui/components/item";
import { useRegisterFluidHoverItem } from "@freenary/ui/hooks/use-fluid-hover";
import { RiBankLine } from "@remixicon/react";
import { useRef } from "react";

import { m } from "@/paraglide/messages.js";
import { SyncButton } from "@/shared/ui/sync-button";

import type { BankRow } from "../model/bank-rows";
import { DisconnectBankDialog } from "./disconnect-bank-dialog";
import { ReconnectBankButton } from "./reconnect-bank-button";

interface BankCardProps {
  connecting: boolean;
  disconnecting: boolean;
  hoverIndex: number;
  onConnect: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
  onSync: () => void;
  registerHoverItem: (index: number, element: HTMLElement | null) => void;
  row: BankRow;
  syncing: boolean;
}

export const BankCard = ({
  connecting,
  disconnecting,
  hoverIndex,
  onConnect,
  onDisconnect,
  onReconnect,
  onSync,
  registerHoverItem,
  row,
  syncing,
}: BankCardProps) => {
  const rowRef = useRef<HTMLLIElement>(null);
  useRegisterFluidHoverItem(registerHoverItem, hoverIndex, rowRef);

  return (
    <Item
      render={<li ref={rowRef} />}
      className={row.connection ? "border-primary bg-secondary" : undefined}
      size="sm"
      variant="outline"
    >
      <ItemMedia
        className="text-muted-foreground [&_img]:object-contain [&_svg]:size-5"
        variant="image"
      >
        {row.logo ? <img alt="" src={row.logo} /> : <RiBankLine />}
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="block w-full truncate">{row.name}</ItemTitle>
        {row.description ? (
          <ItemDescription>{row.description}</ItemDescription>
        ) : null}
      </ItemContent>
      <ItemActions>
        {row.connection ? (
          <>
            {row.connection.status === "ACTIVE" ? (
              <SyncButton
                isSyncing={syncing}
                label={m.bank_row_sync({ institution: row.name })}
                onSync={onSync}
                size="icon-compact"
              />
            ) : (
              <ReconnectBankButton
                institutionName={row.name}
                isReconnecting={connecting}
                onReconnect={onReconnect}
              />
            )}
            <DisconnectBankDialog
              accountCount={row.connection.accounts.length}
              institutionName={row.name}
              isDisconnecting={disconnecting}
              onConfirm={onDisconnect}
            />
          </>
        ) : (
          <Button
            loading={connecting}
            onClick={onConnect}
            type="button"
            variant="secondary"
          >
            {m.bank_connect()}
          </Button>
        )}
      </ItemActions>
    </Item>
  );
};
