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
import { Button } from "@freenary/ui/components/button";
import { useState } from "react";

import { useRecategoriseTransactions } from "@/features/account-sync";
import { m } from "@/paraglide/messages.js";

interface RecategoriseButtonProps {
  isSyncing: boolean;
}

export const RecategoriseButton = ({ isSyncing }: RecategoriseButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { isRecategorising, recategorise } = useRecategoriseTransactions();

  return (
    <>
      <Button
        disabled={isSyncing}
        loading={isRecategorising}
        onClick={() => setIsOpen(true)}
        type="button"
        variant="ghost"
      >
        {m.settings_recategorise_action()}
      </Button>
      <AlertDialog onOpenChange={setIsOpen} open={isOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {m.budget_recategorise_confirm_title()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {m.budget_recategorise_confirm_description()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.settings_cancel()}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsOpen(false);
                recategorise();
              }}
            >
              {m.settings_recategorise_action()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
