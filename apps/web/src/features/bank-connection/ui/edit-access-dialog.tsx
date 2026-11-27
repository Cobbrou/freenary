import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@freenary/ui/components/alert-dialog";
import type { RefObject } from "react";

import { m } from "@/paraglide/messages.js";

interface EditAccessDialogProps {
  finalFocus?: RefObject<HTMLElement | null>;
  institutionName: string;
  isRedirecting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export const EditAccessDialog = ({
  finalFocus,
  institutionName,
  isRedirecting,
  onConfirm,
  onOpenChange,
  open,
}: EditAccessDialogProps) => (
  <AlertDialog onOpenChange={onOpenChange} open={open}>
    <AlertDialogContent finalFocus={finalFocus}>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {m.bank_edit_access_confirm_title({ institution: institutionName })}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {m.bank_edit_access_confirm_description({
            institution: institutionName,
          })}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{m.bank_edit_access_cancel()}</AlertDialogCancel>
        <AlertDialogAction loading={isRedirecting} onClick={onConfirm}>
          {m.bank_edit_access_confirm({ institution: institutionName })}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
