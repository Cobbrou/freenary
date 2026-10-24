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

import { m } from "@/paraglide/messages.js";

interface TurnOffDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  provider: string;
}

export const TurnOffDialog = ({
  isOpen,
  onCancel,
  onConfirm,
  provider,
}: TurnOffDialogProps) => (
  <AlertDialog
    onOpenChange={(next) => {
      if (!next) {
        onCancel();
      }
    }}
    open={isOpen}
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {m.settings_integrations_turn_off_title({ provider })}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {m.settings_integrations_turn_off_description()}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{m.settings_cancel()}</AlertDialogCancel>
        <AlertDialogAction
          className="text-destructive hover:text-destructive"
          onClick={onConfirm}
          variant="ghost"
        >
          {m.setup_turn_off()}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
