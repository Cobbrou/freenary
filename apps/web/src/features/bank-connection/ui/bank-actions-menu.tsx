import { Button } from "@freenary/ui/components/button";
import {
  DropdownContent,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from "@freenary/ui/components/dropdown";
import { MenuItem } from "@freenary/ui/components/menu-item";
import { Spinner } from "@freenary/ui/components/spinner";
import {
  RiDeleteBinLine,
  RiLinkM,
  RiMoreFill,
  RiRefreshLine,
  RiShieldKeyholeLine,
} from "@remixicon/react";
import { useRef, useState } from "react";

import { m } from "@/paraglide/messages.js";
import { remixIcon } from "@/shared/lib/remix-icon";

import type { BankConnection } from "../model/use-bank-connections";
import { DisconnectBankDialog } from "./disconnect-bank-dialog";
import { EditAccessDialog } from "./edit-access-dialog";

type OpenDialog = "edit-access" | "remove" | null;

interface BankActionsMenuProps {
  connection: BankConnection;
  institutionName: string;
  isDisconnecting: boolean;
  isRedirecting: boolean;
  isSyncing: boolean;
  onDisconnect: () => void;
  onReconnect: () => void;
  onSync: () => void;
}

const SYNC_ROW = 0;

export const BankActionsMenu = ({
  connection,
  institutionName,
  isDisconnecting,
  isRedirecting,
  isSyncing,
  onDisconnect,
  onReconnect,
  onSync,
}: BankActionsMenuProps) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const isActive = connection.status === "ACTIVE";
  const isPending = isSyncing || isRedirecting || isDisconnecting;
  const accessRow = isActive ? SYNC_ROW + 1 : SYNC_ROW;
  const removeRow = accessRow + 1;

  const closeDialogOnDismiss = (open: boolean) => {
    if (!open) {
      setOpenDialog(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownTrigger
          aria-busy={isPending}
          aria-label={m.bank_actions_label({ institution: institutionName })}
          ref={triggerRef}
          render={<Button size="icon-compact" type="button" variant="ghost" />}
        >
          {isPending ? <Spinner /> : <RiMoreFill />}
        </DropdownTrigger>
        <DropdownContent align="end" className="w-52 min-w-0">
          {isActive ? (
            <MenuItem
              disabled={isSyncing}
              icon={remixIcon(RiRefreshLine)}
              index={SYNC_ROW}
              label={
                isSyncing ? m.budget_sync_running() : m.bank_actions_sync()
              }
              onSelect={onSync}
            />
          ) : null}
          {isActive ? (
            <MenuItem
              disabled={isRedirecting}
              icon={remixIcon(RiShieldKeyholeLine)}
              index={accessRow}
              label={m.bank_edit_access()}
              onSelect={() => setOpenDialog("edit-access")}
            />
          ) : (
            <MenuItem
              disabled={isRedirecting}
              icon={remixIcon(RiLinkM)}
              index={accessRow}
              label={m.bank_reconnect()}
              onSelect={onReconnect}
            />
          )}
          <DropdownSeparator />
          <MenuItem
            className="**:text-destructive!"
            icon={remixIcon(RiDeleteBinLine)}
            index={removeRow}
            label={m.bank_disconnect()}
            onSelect={() => setOpenDialog("remove")}
          />
        </DropdownContent>
      </DropdownMenu>
      {isActive ? (
        <EditAccessDialog
          finalFocus={triggerRef}
          institutionName={institutionName}
          isRedirecting={isRedirecting}
          onConfirm={onReconnect}
          onOpenChange={closeDialogOnDismiss}
          open={openDialog === "edit-access"}
        />
      ) : null}
      <DisconnectBankDialog
        accountCount={connection.accounts.length}
        finalFocus={triggerRef}
        institutionName={institutionName}
        isDisconnecting={isDisconnecting}
        onConfirm={onDisconnect}
        onOpenChange={closeDialogOnDismiss}
        open={openDialog === "remove"}
      />
    </>
  );
};
