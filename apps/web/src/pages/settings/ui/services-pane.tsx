import { applyFailureMessage } from "../model/apply-failure";
import { useIntegrationSettings } from "../model/use-integration-settings";
import { IntegrationDialog } from "./integration-dialog";
import { IntegrationsRestartNotice } from "./integrations-restart-notice";
import { ServicesSection } from "./services-section";

export const ServicesPane = () => {
  const integrations = useIntegrationSettings(true);

  return (
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
};
