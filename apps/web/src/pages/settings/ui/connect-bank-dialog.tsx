import { Button } from "@freenary/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@freenary/ui/components/dialog";
import { useQuery } from "@tanstack/react-query";

import { BankConnectionPanel } from "@/features/bank-connection";
import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";

const INSTITUTIONS_FOR_THE_USERS_OWN_JURISDICTIONS = {};

export const ConnectBankDialog = () => {
  const banksQuery = useQuery(
    orpc.bankConnection.listInstitutions.queryOptions({
      input: INSTITUTIONS_FOR_THE_USERS_OWN_JURISDICTIONS,
    })
  );

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button className="pointer-coarse:min-h-11" variant="secondary">
            {m.settings_bank_accounts_connect()}
          </Button>
        }
      />
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{m.settings_bank_accounts_connect()}</DialogTitle>
          <DialogDescription>
            {m.settings_bank_accounts_connect_description()}
          </DialogDescription>
        </DialogHeader>
        <BankConnectionPanel
          banks={banksQuery.data?.banks ?? []}
          isBanksError={banksQuery.isError}
          isBanksPending={banksQuery.isPending}
          returnTo="settings"
          unavailableCountries={banksQuery.data?.unavailableCountries ?? []}
        />
      </DialogContent>
    </Dialog>
  );
};
