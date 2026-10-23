import { Button } from "@freenary/ui/components/button";
import { Spinner } from "@freenary/ui/components/spinner";

import { restartDocsUrl } from "@/features/instance-integration";
import { m } from "@/paraglide/messages.js";

import { SettingsSection } from "./settings-section";

type RestartPhase = "idle" | "reconnecting" | "stalled";

interface IntegrationsRestartNoticeProps {
  applyError: string | null;
  isApplying: boolean;
  onApply: () => void;
  onReconnect: () => void;
  restartPhase: RestartPhase;
  restartRequired: boolean;
}

export const IntegrationsRestartNotice = ({
  applyError,
  isApplying,
  onApply,
  onReconnect,
  restartPhase,
  restartRequired,
}: IntegrationsRestartNoticeProps) => {
  if (restartPhase === "reconnecting") {
    return (
      <output className="block">
        <SettingsSection
          action={<Spinner />}
          description={m.setup_applying_description()}
          title={m.setup_applying_title()}
        />
      </output>
    );
  }

  if (restartPhase === "stalled") {
    return (
      <div role="alert">
        <SettingsSection
          description={m.setup_stalled_description()}
          title={m.setup_stalled_title()}
        >
          <div className="flex items-center gap-3">
            <Button onClick={onReconnect} variant="secondary">
              {m.setup_try_again()}
            </Button>
            <a
              className="text-muted-foreground hover:text-foreground underline underline-offset-2"
              href={restartDocsUrl()}
              rel="noopener noreferrer"
              target="_blank"
            >
              {m.setup_view_troubleshooting()}
            </a>
          </div>
        </SettingsSection>
      </div>
    );
  }

  if (!restartRequired) {
    return null;
  }

  return (
    <SettingsSection
      action={
        <Button loading={isApplying} onClick={onApply}>
          {m.settings_integrations_apply()}
        </Button>
      }
      description={m.settings_integrations_restart_description()}
      title={m.settings_integrations_restart_title()}
    >
      {applyError === null ? null : (
        <p className="text-destructive" role="alert">
          {applyError}
        </p>
      )}
    </SettingsSection>
  );
};
