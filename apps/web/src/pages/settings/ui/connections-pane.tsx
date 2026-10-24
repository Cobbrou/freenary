import { m } from "@/paraglide/messages.js";

import { applyFailureMessage } from "../model/apply-failure";
import { showsServices } from "../model/settings-nav-items";
import type { OperatorStanding } from "../model/settings-nav-items";
import { useIntegrationSettings } from "../model/use-integration-settings";
import type { IntegrationSettings } from "../model/use-integration-settings";
import { BankAccountsSection } from "./bank-accounts-section";
import { IntegrationDialog } from "./integration-dialog";
import { IntegrationsRestartNotice } from "./integrations-restart-notice";
import { ServicesSection } from "./services-section";
import { SettingsGroup } from "./settings-group";

interface ServicesPaneProps {
  integrations: IntegrationSettings;
}

const ServicesPane = ({ integrations }: ServicesPaneProps) => (
  <>
    <ServicesSection
      isError={integrations.isError}
      isPending={integrations.isPending}
      notice={
        <IntegrationsRestartNotice
          applyError={
            integrations.applyFailure === null
              ? null
              : applyFailureMessage(integrations.applyFailure)
          }
          isApplying={integrations.isApplying}
          onApply={integrations.handleApply}
          onReconnect={integrations.handleReconnect}
          restartPhase={integrations.restartPhase}
          restartRequired={integrations.restartRequired}
        />
      }
      onConfigure={integrations.handleConfigure}
      onRetry={integrations.handleRetry}
      rows={integrations.rows}
    />

    <IntegrationDialog
      connectionCount={integrations.connectionCount}
      integration={integrations.opened}
      isBusy={integrations.isBusy}
      isChecking={integrations.isChecking}
      isOpen={integrations.isOpen}
      isSwitchPending={integrations.isSwitchPending}
      onCancelSwitch={integrations.handleCancelSwitch}
      onCheckEnvironment={integrations.handleCheckEnvironment}
      onClose={integrations.handleClose}
      onConfirmSwitch={integrations.handleConfirmSwitch}
      onEdit={integrations.handleEdit}
      onSave={integrations.handleSubmit}
      onTurnOff={integrations.handleTurnOff}
      outcome={integrations.outcome}
      stepKey={integrations.dialogKey}
    />
  </>
);

interface ConnectionsPaneProps {
  standing: OperatorStanding;
}

export const ConnectionsPane = ({ standing }: ConnectionsPaneProps) => {
  const withServices = showsServices(standing);
  const integrations = useIntegrationSettings(withServices);

  return (
    <SettingsGroup
      description={m.settings_group_connections_description()}
      title={m.settings_group_connections_title()}
    >
      <BankAccountsSection />

      {withServices ? <ServicesPane integrations={integrations} /> : null}
    </SettingsGroup>
  );
};
