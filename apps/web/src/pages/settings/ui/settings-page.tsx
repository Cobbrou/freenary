import type { CategoryEntry } from "@freenary/api/lib/categories";
import { Button } from "@freenary/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@freenary/ui/components/empty";
import { RiErrorWarningLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";
import { useOauthCallbackError } from "@/shared/auth";
import type { SettingsSection } from "@/shared/config";

import {
  authAccountsQueryOptions,
  authSessionsQueryOptions,
  CREDENTIAL_PROVIDER_ID,
} from "../api/auth-queries";
import type { LinkedAccount, UserSession } from "../api/auth-queries";
import { applyFailureMessage } from "../model/apply-failure";
import {
  operatorStandingOf,
  shownSettingsSection,
} from "../model/settings-nav-items";
import type { OperatorStanding } from "../model/settings-nav-items";
import { useBudgetProfileEditor } from "../model/use-budget-profile-editor";
import type {
  BudgetProfileEditor,
  ServerBudgetLine,
} from "../model/use-budget-profile-editor";
import { useIntegrationSettings } from "../model/use-integration-settings";
import type { IntegrationSettings } from "../model/use-integration-settings";
import {
  AppearanceLocaleSection,
  AppearanceThemeSection,
} from "./appearance-section";
import { BankAccountsSection } from "./bank-accounts-section";
import { BudgetingSection } from "./budgeting-section";
import { CategoriesSection } from "./categories-section";
import { IntegrationDialog } from "./integration-dialog";
import { IntegrationsRestartNotice } from "./integrations-restart-notice";
import { IntegrationsSection } from "./integrations-section";
import { SecurityAccountsSection } from "./security-accounts-section";
import type { OAuthProviderOption } from "./security-accounts-section";
import { SecurityPasskeysSection } from "./security-passkeys-section";
import { SecuritySessionsSection } from "./security-sessions-section";
import { SecurityTwoFactorSection } from "./security-two-factor-section";
import { SettingsGroup } from "./settings-group";
import { SettingsNav } from "./settings-nav";
import { UnsavedChangesBar } from "./unsaved-changes-bar";

interface SecurityPaneProps {
  accounts: LinkedAccount[] | undefined;
  isAccountsPending: boolean;
  isSessionsPending: boolean;
  providers: OAuthProviderOption[] | undefined;
  sessions: UserSession[] | undefined;
}

interface BudgetPaneProps {
  categories: CategoryEntry[];
  editor: BudgetProfileEditor;
  isCategoriesPending: boolean;
  isPending: boolean;
}

interface SettingsContentProps extends SecurityPaneProps {
  categories: CategoryEntry[];
  isCategoriesPending: boolean;
  isPending: boolean;
  operatorStanding: OperatorStanding;
  section: SettingsSection;
  serverLines: ServerBudgetLine[] | undefined;
}

const AppearancePane = () => (
  <SettingsGroup
    description={m.settings_group_appearance_description()}
    title={m.settings_group_appearance_title()}
  >
    <AppearanceThemeSection />

    <AppearanceLocaleSection />
  </SettingsGroup>
);

const ConnectionsPane = () => (
  <SettingsGroup
    description={m.settings_group_connections_description()}
    title={m.settings_group_connections_title()}
  >
    <BankAccountsSection />
  </SettingsGroup>
);

const BudgetPane = ({
  categories,
  editor,
  isCategoriesPending,
  isPending,
}: BudgetPaneProps) => (
  <SettingsGroup
    description={m.settings_group_budget_description()}
    title={m.settings_group_budget_title()}
  >
    <BudgetingSection
      addLine={editor.addLine}
      categories={categories}
      errors={editor.errors}
      isPending={isPending}
      lines={editor.lines}
      moveLine={editor.moveLine}
      removeLine={editor.removeLine}
      reorderLines={editor.reorderLines}
      updateLine={editor.updateLine}
    />

    <CategoriesSection
      categories={categories}
      isPending={isCategoriesPending}
    />

    <UnsavedChangesBar
      changeCount={editor.changeCount}
      hasErrors={editor.errors.size > 0}
      isSaving={editor.isSaving}
      onCancel={() => editor.reset()}
      onSave={() => editor.save()}
    />
  </SettingsGroup>
);

const SecurityPane = ({
  accounts,
  isAccountsPending,
  isSessionsPending,
  providers,
  sessions,
}: SecurityPaneProps) => (
  <SettingsGroup
    description={m.settings_group_security_description()}
    title={m.settings_group_security_title()}
  >
    <SecurityTwoFactorSection
      hasPassword={accounts?.some(
        (account) => account.providerId === CREDENTIAL_PROVIDER_ID
      )}
      isAccountsPending={isAccountsPending}
    />

    <SecurityPasskeysSection />

    <SecuritySessionsSection
      isPending={isSessionsPending}
      sessions={sessions}
    />

    <SecurityAccountsSection
      accounts={accounts}
      isPending={isAccountsPending}
      providers={providers}
    />
  </SettingsGroup>
);

interface IntegrationsPaneProps {
  integrations: IntegrationSettings;
}

const IntegrationsPane = ({ integrations }: IntegrationsPaneProps) => (
  <SettingsGroup
    description={m.settings_group_integrations_description()}
    title={m.settings_group_integrations_title()}
  >
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

    <IntegrationsSection
      isError={integrations.isError}
      isPending={integrations.isPending}
      onConfigure={integrations.handleConfigure}
      onRetry={integrations.handleRetry}
      rows={integrations.rows}
    />

    <IntegrationDialog
      integration={integrations.opened}
      isBusy={integrations.isBusy}
      isChecking={integrations.isChecking}
      isOpen={integrations.isOpen}
      onCheckEnvironment={integrations.handleCheckEnvironment}
      onClose={integrations.handleClose}
      onEdit={integrations.handleEdit}
      onSave={integrations.handleSubmit}
      onTurnOff={integrations.handleTurnOff}
      outcome={integrations.outcome}
      stepKey={integrations.dialogKey}
    />
  </SettingsGroup>
);

const SettingsContent = ({
  accounts,
  categories,
  isAccountsPending,
  isCategoriesPending,
  isPending,
  isSessionsPending,
  operatorStanding,
  providers,
  section,
  serverLines,
  sessions,
}: SettingsContentProps) => {
  const editor = useBudgetProfileEditor(serverLines, categories);
  const shownSection = shownSettingsSection(section, operatorStanding);
  const integrations = useIntegrationSettings(shownSection === "integrations");

  const panes = {
    appearance: <AppearancePane />,
    budget: (
      <BudgetPane
        categories={categories}
        editor={editor}
        isCategoriesPending={isCategoriesPending}
        isPending={isPending}
      />
    ),
    connections: <ConnectionsPane />,
    integrations: <IntegrationsPane integrations={integrations} />,
    security: (
      <SecurityPane
        accounts={accounts}
        isAccountsPending={isAccountsPending}
        isSessionsPending={isSessionsPending}
        providers={providers}
        sessions={sessions}
      />
    ),
  } satisfies Record<SettingsSection, ReactNode>;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pb-20 lg:flex-row lg:gap-8">
      <SettingsNav section={shownSection} standing={operatorStanding} />

      <div
        aria-busy={shownSection === null}
        className="flex min-w-0 flex-1 flex-col gap-8"
      >
        {shownSection === null ? null : panes[shownSection]}
      </div>
    </div>
  );
};

export const SettingsPage = () => {
  const { error, section } = useSearch({ from: "/_auth/settings" });
  const navigate = useNavigate();

  useOauthCallbackError(error, () => {
    void navigate({ replace: true, search: { section }, to: "/settings" });
  });

  const categoriesQuery = useQuery(orpc.settings.listCategories.queryOptions());
  const profileQuery = useQuery(orpc.settings.getBudgetProfile.queryOptions());
  const capabilitiesQuery = useQuery(orpc.auth.capabilities.queryOptions());
  const sessionsQuery = useQuery(authSessionsQueryOptions());
  const accountsQuery = useQuery(authAccountsQueryOptions());
  const instanceStatusQuery = useQuery(orpc.instance.status.queryOptions());

  if (categoriesQuery.isError || profileQuery.isError) {
    const isRetrying = categoriesQuery.isFetching || profileQuery.isFetching;

    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiErrorWarningLine />
          </EmptyMedia>
          <EmptyTitle>{m.settings_load_error_title()}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button
            loading={isRetrying}
            onClick={() => {
              void categoriesQuery.refetch();
              void profileQuery.refetch();
            }}
            variant="tertiary"
          >
            {m.settings_retry()}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <SettingsContent
      accounts={accountsQuery.data}
      categories={categoriesQuery.data?.categories ?? []}
      isAccountsPending={accountsQuery.isPending || capabilitiesQuery.isPending}
      isCategoriesPending={categoriesQuery.isPending}
      isPending={categoriesQuery.isPending || profileQuery.isPending}
      isSessionsPending={sessionsQuery.isPending}
      operatorStanding={operatorStandingOf({
        isOperator: instanceStatusQuery.data?.isOperator,
        isPending: instanceStatusQuery.isPending,
      })}
      providers={capabilitiesQuery.data?.oauth}
      section={section}
      serverLines={profileQuery.data?.lines}
      sessions={sessionsQuery.data}
    />
  );
};
