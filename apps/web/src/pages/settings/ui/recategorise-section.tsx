import { Button } from "@freenary/ui/components/button";

import {
  useRecategoriseTransactions,
  useSyncAccounts,
} from "@/features/account-sync";
import { m } from "@/paraglide/messages.js";

import { SettingsSection } from "./settings-section";

export const RecategoriseSection = () => {
  const { isRecategorising, recategorise } = useRecategoriseTransactions();
  const { isSyncing } = useSyncAccounts();

  return (
    <SettingsSection
      action={
        <Button
          disabled={isSyncing}
          loading={isRecategorising}
          onClick={recategorise}
          variant="tertiary"
        >
          {m.settings_recategorise_action()}
        </Button>
      }
      description={m.settings_recategorise_description()}
      title={m.settings_recategorise_title()}
    />
  );
};
