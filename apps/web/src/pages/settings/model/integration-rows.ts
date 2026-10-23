import { m } from "@/paraglide/messages.js";

interface IntegrationRow {
  description: () => string;
  id: string;
}

export const INTEGRATION_ROWS = [
  {
    description: m.settings_integrations_categorisation_description,
    id: "categorisation",
  },
  {
    description: m.settings_integrations_email_description,
    id: "email",
  },
  {
    description: m.settings_integrations_assistant_description,
    id: "assistant",
  },
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
