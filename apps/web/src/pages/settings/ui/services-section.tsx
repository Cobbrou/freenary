import { Button } from "@freenary/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@freenary/ui/components/item";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { useSize } from "@freenary/ui/lib/size-context";
import { cn } from "@freenary/ui/lib/utils";
import type * as React from "react";

import {
  integrationTitle,
  variantLabel,
} from "@/features/instance-integration";
import type { SetupIntegrationDescriptor } from "@/features/instance-integration";
import { m } from "@/paraglide/messages.js";

import {
  integrationRowAction,
  integrationRowStatus,
  integrationRowStatusText,
} from "../model/integration-rows";
import type {
  IntegrationRowAction,
  IntegrationRowEntry,
} from "../model/integration-rows";
import { SettingsListSurface } from "./settings-list-surface";
import { SettingsSubgroup } from "./settings-subgroup";

const ACTION_LABELS = {
  change: m.settings_services_change,
  "set-up": m.settings_services_set_up,
  view: m.settings_services_view,
} satisfies Record<IntegrationRowAction, () => string>;

const ACTION_NAMED_LABELS = {
  change: m.settings_services_change_named,
  "set-up": m.settings_services_set_up_named,
  view: m.settings_services_view_named,
} satisfies Record<
  IntegrationRowAction,
  (inputs: { service: string }) => string
>;

interface ServicesSectionProps {
  isError: boolean;
  isPending: boolean;
  notice: React.ReactNode;
  onConfigure: (integrationId: string) => void;
  onRetry: () => void;
  rows: IntegrationRowEntry<SetupIntegrationDescriptor>[];
}

export const ServicesSection = ({
  isError,
  isPending,
  notice,
  onConfigure,
  onRetry,
  rows,
}: ServicesSectionProps) => {
  const { control } = useSize();

  const renderRows = () => {
    if (isError) {
      return (
        <div className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
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
      <ul aria-busy={isPending} className="flex flex-col">
        {rows.map(({ integration, row }) => {
          const title = integrationTitle(row.id);
          const status =
            integration === undefined
              ? null
              : integrationRowStatus(integration);

          const action = status === null ? null : integrationRowAction(status);

          return (
            <li className="border-border not-first:border-t" key={row.id}>
              <Item size="sm">
                <ItemMedia className="text-muted-foreground" variant="icon">
                  <row.icon aria-hidden="true" />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>{title}</ItemTitle>
                  {status === null ? (
                    <span
                      aria-hidden="true"
                      className="flex h-[1.5em] items-center"
                    >
                      <Skeleton className="h-3 w-32" />
                    </span>
                  ) : (
                    <ItemDescription className="line-clamp-none">
                      {integrationRowStatusText(status, variantLabel)}
                    </ItemDescription>
                  )}
                </ItemContent>
                <ItemActions>
                  {integration === undefined || action === null ? (
                    <Skeleton
                      aria-hidden="true"
                      className={cn("w-20 rounded-md", control)}
                    />
                  ) : (
                    <Button
                      aria-label={ACTION_NAMED_LABELS[action]({
                        service: title,
                      })}
                      onClick={() => onConfigure(integration.id)}
                      variant="secondary"
                    >
                      {ACTION_LABELS[action]()}
                    </Button>
                  )}
                </ItemActions>
              </Item>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <SettingsSubgroup
      description={m.settings_services_description()}
      title={m.settings_services_title()}
    >
      {isPending ? (
        <output className="sr-only">{m.settings_integrations_loading()}</output>
      ) : null}
      {notice}
      <SettingsListSurface>{renderRows()}</SettingsListSurface>
    </SettingsSubgroup>
  );
};
