import { MAX_ACCOUNT_NAME_LENGTH } from "@freenary/api/lib/account-name";
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
import { Field, FieldLabel } from "@freenary/ui/components/field";
import { Input } from "@freenary/ui/components/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";

import { ACCOUNT_TYPE_LABELS } from "@/entities/account";
import type { PortfolioAccount } from "@/entities/account";
import { invalidateBudgetData } from "@/entities/budget";
import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";

export const AccountRename = ({ account }: { account: PortfolioAccount }) => {
  const queryClient = useQueryClient();
  const fieldId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const rename = useMutation(
    orpc.portfolio.renameAccount.mutationOptions({
      onError: () => {
        toast.error(m.bank_account_rename_error());
      },
      onSettled: () => invalidateBudgetData(queryClient),
      onSuccess: () => setDraft(null),
    })
  );

  const save = (name: string | null) =>
    rename.mutate({ accountId: account.id, name });

  return (
    <>
      <Button
        onClick={() => setDraft(account.customName ?? account.name ?? "")}
        size="compact"
        type="button"
        variant="tertiary"
      >
        {m.bank_account_rename()}
      </Button>
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setDraft(null);
          }
        }}
        open={draft !== null}
      >
        <AlertDialogContent size="sm">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              save(draft);
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {m.bank_account_rename_title()}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {m.bank_account_rename_description({
                  bankName:
                    account.bankName ?? ACCOUNT_TYPE_LABELS[account.type](),
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Field className="py-4">
              <FieldLabel htmlFor={fieldId}>
                {m.bank_account_rename_label()}
              </FieldLabel>
              <Input
                autoComplete="off"
                id={fieldId}
                maxLength={MAX_ACCOUNT_NAME_LENGTH}
                onChange={(event) => setDraft(event.target.value)}
                value={draft ?? ""}
              />
              {account.customName === null ? null : (
                <Button
                  className="self-start"
                  disabled={rename.isPending}
                  onClick={() => save(null)}
                  size="compact"
                  type="button"
                  variant="ghost"
                >
                  {m.bank_account_rename_restore()}
                </Button>
              )}
            </Field>
            <AlertDialogFooter>
              <AlertDialogCancel>{m.settings_cancel()}</AlertDialogCancel>
              <AlertDialogAction loading={rename.isPending} type="submit">
                {m.bank_account_rename_confirm()}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
