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

interface DeleteDashboardDialogProps {
  isDeleting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

export const DeleteDashboardDialog = ({
  isDeleting,
  onConfirm,
  onOpenChange,
  open,
  title,
}: DeleteDashboardDialogProps) => (
  <AlertDialog onOpenChange={onOpenChange} open={open}>
    <AlertDialogContent size="sm">
      <AlertDialogHeader>
        <AlertDialogTitle>
          {m.dashboard_delete_title({ title })}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {m.dashboard_delete_description()}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{m.settings_cancel()}</AlertDialogCancel>
        <AlertDialogAction
          className="text-destructive hover:text-destructive"
          loading={isDeleting}
          onClick={onConfirm}
          variant="ghost"
        >
          {m.dashboard_delete_confirm()}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
