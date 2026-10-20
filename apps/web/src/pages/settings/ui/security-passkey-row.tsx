import type { Passkey } from "@better-auth/passkey/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@freenary/ui/components/alert-dialog";
import { Badge } from "@freenary/ui/components/badge";
import { Button } from "@freenary/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@freenary/ui/components/item";
import { useRegisterFluidHoverItem } from "@freenary/ui/hooks/use-fluid-hover";
import { useRef, useState } from "react";

import { m } from "@/paraglide/messages.js";

import type { PasskeyRenameInput } from "../model/use-passkey-actions";
import { SecurityPasskeyNameDialog } from "./security-passkey-name-dialog";

type PasskeyReachSlug = "device_only" | "not_backed_up" | "synced";

interface SecurityPasskeyRowProps {
  formatter: Intl.DateTimeFormat;
  index: number;
  isRemoving: boolean;
  isRenaming: boolean;
  onRemove: (id: string) => void;
  onRename: (input: PasskeyRenameInput) => void;
  passkey: Passkey;
  registerItem: (index: number, element: HTMLElement | null) => void;
}

const REACH_LABELS = {
  device_only: m.settings_passkeys_reach_device_only,
  not_backed_up: m.settings_passkeys_reach_not_backed_up,
  synced: m.settings_passkeys_reach_synced,
} satisfies Record<PasskeyReachSlug, () => string>;

const signInReachOf = (passkey: Passkey): PasskeyReachSlug => {
  if (passkey.deviceType === "singleDevice") {
    return "device_only";
  }

  return passkey.backedUp ? "synced" : "not_backed_up";
};

export const SecurityPasskeyRow = ({
  formatter,
  index,
  isRemoving,
  isRenaming,
  onRemove,
  onRename,
  passkey,
  registerItem,
}: SecurityPasskeyRowProps) => {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const storedName = passkey.name?.trim() ?? "";
  const displayName =
    storedName === "" ? m.settings_passkeys_unnamed() : storedName;

  const reach = REACH_LABELS[signInReachOf(passkey)]();

  useRegisterFluidHoverItem(registerItem, index, rowRef);

  return (
    <Item className="relative z-10" ref={rowRef} render={<li />} size="sm">
      <ItemContent className="min-w-0">
        <ItemTitle className="flex flex-wrap items-center gap-2">
          {displayName}
          <Badge>{reach}</Badge>
        </ItemTitle>
        <ItemDescription>
          {m.settings_passkeys_registered({
            date: formatter.format(passkey.createdAt),
          })}
        </ItemDescription>
      </ItemContent>

      <ItemActions>
        <Button
          aria-label={m.settings_passkeys_rename_passkey({
            passkey: displayName,
          })}
          loading={isRenaming}
          onClick={() => setIsRenameOpen(true)}
          variant="tertiary"
        >
          {m.settings_passkeys_rename()}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                aria-label={m.settings_passkeys_remove_passkey({
                  passkey: displayName,
                })}
                disabled={isRemoving}
                variant="ghost"
              />
            }
          >
            {m.settings_passkeys_remove()}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {m.settings_passkeys_remove_title({ passkey: displayName })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {m.settings_passkeys_remove_description()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{m.settings_cancel()}</AlertDialogCancel>
              <AlertDialogAction
                loading={isRemoving}
                onClick={() => onRemove(passkey.id)}
                variant="ghost"
                className="text-destructive hover:text-destructive"
              >
                {m.settings_passkeys_remove_confirm()}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ItemActions>

      <SecurityPasskeyNameDialog
        confirmLabel={m.settings_passkeys_rename_confirm()}
        defaultName={storedName}
        description={m.settings_passkeys_rename_description()}
        onOpenChange={setIsRenameOpen}
        onSubmit={(next) => onRename({ id: passkey.id, name: next })}
        open={isRenameOpen}
        title={m.settings_passkeys_rename_title()}
      />
    </Item>
  );
};
