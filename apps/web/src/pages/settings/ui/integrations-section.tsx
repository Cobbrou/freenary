import { Button } from "@freenary/ui/components/button";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { useSize } from "@freenary/ui/lib/size-context";
import { cn } from "@freenary/ui/lib/utils";

import {
  integrationTitle,
  stateLabel,
  variantLabel,
} from "@/features/instance-integration";
import type { SetupIntegrationDescriptor } from "@/features/instance-integration";
import { m } from "@/paraglide/messages.js";

import { integrationRowStatus } from "../model/integration-rows";
import type {
  IntegrationRowEntry,
  IntegrationRowStatus,
} from "../model/integration-rows";
import { SettingsSection } from "./settings-section";

const statusText = (status: IntegrationRowStatus): string => {
  if (status.kind === "configured") {
    return m.settings_integrations_state_configured({
      provider: variantLabel(status.variantId),
    });
  }

  if (status.kind === "environment") {
    return m.settings_integrations_state_environment({
      provider: variantLabel(status.variantId),
    });
  }

  return stateLabel(status.kind);
};

interface IntegrationsSectionProps {
  isError: boolean;
  isPending: boolean;
  onConfigure: (integrationId: string) => void;
  onRetry: () => void;
  rows: IntegrationRowEntry<SetupIntegrationDescriptor>[];
}

export const IntegrationsSection = ({
  isError,
  isPending,
  onConfigure,
  onRetry,
  rows,
}: IntegrationsSectionProps) => {
  const { control } = useSize();

  if (isError) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <p className="text-destructive" role="alert">
          {m.settings_integrations_load_error()}
        </p>
        <Button onClick={onRetry} variant="tertiary">
          {m.settings_retry()}
        </Button>
      </div>
    );
  }

  return (
    <div aria-busy={isPending} className="flex flex-col gap-4">
      {isPending ? (
        <output className="sr-only">{m.settings_integrations_loading()}</output>
      ) : null}
      {rows.map(({ integration, row }) => {
        const title = integrationTitle(row.id);

        return (
          <SettingsSection
            action={
              integration === undefined ? (
                <Skeleton
                  aria-hidden="true"
                  className={cn("w-24 rounded-md", control)}
                />
              ) : (
                <Button
                  aria-label={m.settings_integrations_configure_named({
                    integration: title,
                  })}
                  onClick={() => onConfigure(integration.id)}
                  variant="secondary"
                >
                  {m.settings_integrations_configure()}
                </Button>
              )
            }
            description={row.description()}
            key={row.id}
            title={title}
          >
            {integration === undefined ? (
              <span aria-hidden="true" className="flex h-[1.5em] items-center">
                <Skeleton className="h-3 w-32" />
              </span>
            ) : (
              <p className="text-muted-foreground">
                {statusText(integrationRowStatus(integration))}
              </p>
            )}
          </SettingsSection>
        );
      })}
    </div>
  );
};
