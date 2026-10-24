import {
  RiBankLine,
  RiMailLine,
  RiPriceTag3Line,
  RiSparkling2Line,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";

import { m } from "@/paraglide/messages.js";

interface IntegrationRow {
  icon: RemixiconComponentType;
  id: string;
}

export const INTEGRATION_ROWS = [
  { icon: RiBankLine, id: "banking" },
  { icon: RiPriceTag3Line, id: "categorisation" },
  { icon: RiMailLine, id: "email" },
  { icon: RiSparkling2Line, id: "assistant" },
] as const satisfies readonly IntegrationRow[];

const ENVIRONMENT_OWNER = "environment";

interface DescribedIntegration {
  configuredBy: string | null;
  id: string;
  selectedVariantId: string;
  state: string;
}

export type IntegrationRowStatus =
  | { kind: "configured"; variantId: string }
  | { kind: "disabled" }
  | { kind: "environment"; variantId: string }
  | { kind: "incomplete" };

export type IntegrationRowAction = "change" | "set-up" | "view";

export interface IntegrationRowEntry<Integration> {
  integration: Integration | undefined;
  row: IntegrationRow;
}

export const integrationRowsOf = <Integration extends DescribedIntegration>(
  rows: readonly IntegrationRow[],
  integrations: readonly Integration[] | undefined
): IntegrationRowEntry<Integration>[] => {
  if (integrations === undefined) {
    return rows.map((row) => ({ integration: undefined, row }));
  }

  return rows.flatMap((row) => {
    const integration = integrations.find((entry) => entry.id === row.id);

    return integration === undefined ? [] : [{ integration, row }];
  });
};

export const integrationRowStatus = (
  integration: DescribedIntegration
): IntegrationRowStatus => {
  if (integration.configuredBy === ENVIRONMENT_OWNER) {
    return { kind: "environment", variantId: integration.selectedVariantId };
  }

  if (integration.state === "configured") {
    return { kind: "configured", variantId: integration.selectedVariantId };
  }

  return integration.state === "disabled"
    ? { kind: "disabled" }
    : { kind: "incomplete" };
};

const ACTIONS = {
  configured: "change",
  disabled: "set-up",
  environment: "view",
  incomplete: "set-up",
} as const satisfies Record<IntegrationRowStatus["kind"], IntegrationRowAction>;

export const integrationRowAction = (
  status: IntegrationRowStatus
): IntegrationRowAction => ACTIONS[status.kind];

export const integrationRowStatusText = (
  status: IntegrationRowStatus,
  providerLabel: (variantId: string) => string
): string => {
  if (status.kind === "configured") {
    return m.settings_integrations_state_configured({
      provider: providerLabel(status.variantId),
    });
  }

  if (status.kind === "environment") {
    return m.settings_integrations_state_environment({
      provider: providerLabel(status.variantId),
    });
  }

  return status.kind === "disabled"
    ? m.settings_integrations_state_off()
    : m.settings_integrations_state_incomplete();
};
