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

import { m } from "@/paraglide/messages.js";

interface DeleteAccountDialogProps {
  accountName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  transactionCount: number;
}

export const DeleteAccountDialog = ({
  accountName,
  isDeleting,
  onConfirm,
  transactionCount,
}: DeleteAccountDialogProps) => (
  <AlertDialog>
    <AlertDialogTrigger
      render={
        <Button
          aria-label={m.bank_account_delete_aria_label({
            account: accountName,
          })}
          className="text-destructive hover:text-destructive"
          variant="tertiary"
        />
      }
    >
      {m.bank_account_delete()}
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {m.bank_account_delete_confirm_title({ account: accountName })}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {m.bank_account_delete_confirm_description({
            count: transactionCount,
          })}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{m.bank_account_delete_cancel()}</AlertDialogCancel>
        <AlertDialogAction
          className="text-destructive hover:text-destructive"
          loading={isDeleting}
          onClick={onConfirm}
          variant="ghost"
        >
          {m.bank_account_delete()}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
