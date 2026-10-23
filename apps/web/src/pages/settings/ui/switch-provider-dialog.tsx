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

interface SwitchProviderDialogProps {
  connectionCount: number | undefined;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const SwitchProviderDialog = ({
  connectionCount,
  isOpen,
  onCancel,
  onConfirm,
}: SwitchProviderDialogProps) => (
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
          {m.settings_integrations_switch_title()}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {connectionCount === undefined
            ? m.settings_integrations_switch_description_uncounted()
            : m.settings_integrations_switch_description({
                count: connectionCount,
              })}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{m.settings_cancel()}</AlertDialogCancel>
        <AlertDialogAction
          className="text-destructive hover:text-destructive"
          onClick={onConfirm}
          variant="ghost"
        >
          {m.settings_integrations_switch_confirm()}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
