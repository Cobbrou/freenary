import {
  Banner,
  BannerAction,
  BannerActions,
  BannerDescription,
  BannerTitle,
} from "@freenary/ui/components/banner";
import { Spinner } from "@freenary/ui/components/spinner";
import type { IconComponentProps } from "@freenary/ui/lib/icon-context";

import { restartDocsUrl } from "@/features/instance-integration";
import { m } from "@/paraglide/messages.js";

type RestartPhase = "idle" | "reconnecting" | "stalled";

interface IntegrationsRestartNoticeProps {
  applyError: string | null;
  isApplying: boolean;
  onApply: () => void;
  onReconnect: () => void;
  restartPhase: RestartPhase;
  restartRequired: boolean;
}

const SpinnerIcon = ({ size }: IconComponentProps) => <Spinner size={size} />;

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
      <Banner icon={SpinnerIcon}>
        <BannerTitle>{m.setup_applying_title()}</BannerTitle>
        <BannerDescription>{m.setup_applying_description()}</BannerDescription>
      </Banner>
    );
  }

  if (restartPhase === "stalled") {
    return (
      <Banner status="error">
        <BannerTitle>{m.setup_stalled_title()}</BannerTitle>
        <BannerDescription>{m.setup_stalled_description()}</BannerDescription>
        <BannerActions>
          <BannerAction onClick={onReconnect} variant="primary">
            {m.setup_try_again()}
          </BannerAction>
          <BannerAction external href={restartDocsUrl()} variant="ghost">
            {m.setup_view_troubleshooting()}
          </BannerAction>
        </BannerActions>
      </Banner>
    );
  }

  if (!restartRequired) {
    return null;
  }

  return (
    <Banner status="info">
      <BannerTitle>{m.settings_integrations_restart_title()}</BannerTitle>
      <BannerDescription>
        {m.settings_integrations_restart_description()}
        {applyError === null ? null : (
          <span className="text-destructive mt-1 block" role="alert">
            {applyError}
          </span>
        )}
      </BannerDescription>
      <BannerActions>
        <BannerAction loading={isApplying} onClick={onApply} variant="primary">
          {m.settings_integrations_apply()}
        </BannerAction>
      </BannerActions>
    </Banner>
  );
};
