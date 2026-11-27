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
import { Checkbox } from "@freenary/ui/components/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@freenary/ui/components/field";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";

import { connectedAccountLabel } from "../model/bank-rows";
import type { ConnectedAccount } from "../model/bank-rows";
import {
  forgetLeftOutAccounts,
  useLeftOutAccountIds,
} from "../model/left-out-accounts";
import { useDeleteAccounts } from "../model/use-delete-accounts";

const NO_ACCOUNTS: ConnectedAccount[] = [];

const checkboxIdOf = (accountId: string) => `left-out-account-${accountId}`;

export const LeftOutAccountsDialog = () => {
  const leftOutIds = useLeftOutAccountIds();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const connectionsQuery = useQuery(
    orpc.bankConnection.listConnections.queryOptions({
      enabled: leftOutIds.length > 0,
    })
  );

  const accounts = useMemo(() => {
    if (leftOutIds.length === 0) {
      return NO_ACCOUNTS;
    }

    const wanted = new Set(leftOutIds);

    return (connectionsQuery.data?.connections ?? []).flatMap((connection) =>
      connection.accounts.filter(
        (account) => wanted.has(account.id) && !account.inConsent
      )
    );
  }, [connectionsQuery.data, leftOutIds]);

  const close = () => {
    forgetLeftOutAccounts();
    setSelected(new Set());
  };

  const deleteAccounts = useDeleteAccounts({ onDeleted: close });

  const toggle = (accountId: string, isChecked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);

      if (isChecked) {
        next.add(accountId);
      } else {
        next.delete(accountId);
      }

      return next;
    });
  };

  const ticked = accounts.filter((account) => selected.has(account.id));

  return (
    <AlertDialog
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          close();
        }
      }}
      open={accounts.length > 0}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {m.bank_left_out_title({ count: accounts.length })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {m.bank_left_out_description({ count: accounts.length })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="border-border flex flex-col rounded-lg border">
          {accounts.map((account) => (
            <li className="border-border not-first:border-t" key={account.id}>
              <Field className="px-3 py-2.5" orientation="horizontal">
                <Checkbox
                  checked={selected.has(account.id)}
                  disabled={deleteAccounts.isPending}
                  id={checkboxIdOf(account.id)}
                  onCheckedChange={(isChecked) => toggle(account.id, isChecked)}
                />
                <FieldContent className="min-w-0">
                  <FieldLabel
                    className="break-words"
                    htmlFor={checkboxIdOf(account.id)}
                  >
                    {connectedAccountLabel(account)}
                  </FieldLabel>
                  <FieldDescription>
                    {m.bank_account_transaction_count({
                      count: account.transactionCount,
                    })}
                  </FieldDescription>
                </FieldContent>
              </Field>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteAccounts.isPending}>
            {m.bank_left_out_keep()}
          </AlertDialogCancel>
          <AlertDialogAction
            className="text-destructive hover:text-destructive"
            disabled={ticked.length === 0}
            loading={deleteAccounts.isPending}
            onClick={() =>
              deleteAccounts.mutate(ticked.map((account) => account.id))
            }
            variant="ghost"
          >
            {ticked.length === 0
              ? m.bank_left_out_delete_none()
              : m.bank_left_out_delete({ count: ticked.length })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
