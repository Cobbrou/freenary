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
import { Button } from "@freenary/ui/components/button";
import type { RefObject } from "react";

import { m } from "@/paraglide/messages.js";

interface DisconnectBankDialogProps {
  accountCount: number;
  finalFocus?: RefObject<HTMLElement | null>;
  institutionName: string;
  isDisconnecting: boolean;
  onConfirm: () => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

export const DisconnectBankDialog = ({
  accountCount,
  finalFocus,
  institutionName,
  isDisconnecting,
  onConfirm,
  onOpenChange,
  open,
}: DisconnectBankDialogProps) => {
  const description =
    accountCount > 0
      ? m.bank_disconnect_confirm_description({ count: accountCount })
      : m.bank_disconnect_confirm_description_none();

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      {open === undefined ? (
        <AlertDialogTrigger
          render={
            <Button
              aria-label={m.bank_disconnect_aria_label({
                institution: institutionName,
              })}
              variant="tertiary"
            />
          }
        >
          {m.bank_disconnect()}
        </AlertDialogTrigger>
      ) : null}
      <AlertDialogContent finalFocus={finalFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {m.bank_disconnect_confirm_title({ institution: institutionName })}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{m.bank_disconnect_cancel()}</AlertDialogCancel>
          <AlertDialogAction
            className="text-destructive hover:text-destructive"
            loading={isDisconnecting}
            onClick={onConfirm}
            variant="ghost"
          >
            {m.bank_disconnect_confirm()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
