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
import { useBudgetProfileEditor } from "../model/use-budget-profile-editor";
import type {
  BudgetProfileEditor,
  ServerBudgetLine,
} from "../model/use-budget-profile-editor";
import {
  AppearanceLocaleSection,
  AppearanceThemeSection,
} from "./appearance-section";
import { BankAccountsSection } from "./bank-accounts-section";
import { BudgetingSection } from "./budgeting-section";
import { CategoriesSection } from "./categories-section";
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
  budgetLoadError: ReactNode;
  categories: CategoryEntry[];
  isCategoriesPending: boolean;
  isPending: boolean;
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

const SettingsContent = ({
  accounts,
  budgetLoadError,
  categories,
  isAccountsPending,
  isCategoriesPending,
  isPending,
  isSessionsPending,
  providers,
  section,
  serverLines,
  sessions,
}: SettingsContentProps) => {
  const editor = useBudgetProfileEditor(serverLines, categories);

  const panes = {
    appearance: <AppearancePane />,
    budget: budgetLoadError ?? (
      <BudgetPane
        categories={categories}
        editor={editor}
        isCategoriesPending={isCategoriesPending}
        isPending={isPending}
      />
    ),
    connections: <ConnectionsPane />,
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
      <SettingsNav section={section} />

      <div className="flex min-w-0 flex-1 flex-col gap-8">{panes[section]}</div>
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

  const budgetLoadError =
    categoriesQuery.isError || profileQuery.isError ? (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiErrorWarningLine />
          </EmptyMedia>
          <EmptyTitle>{m.settings_budget_load_error_title()}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button
            loading={categoriesQuery.isFetching || profileQuery.isFetching}
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
    ) : null;

  return (
    <SettingsContent
      accounts={accountsQuery.data}
      budgetLoadError={budgetLoadError}
      categories={categoriesQuery.data?.categories ?? []}
      isAccountsPending={accountsQuery.isPending || capabilitiesQuery.isPending}
      isCategoriesPending={categoriesQuery.isPending}
      isPending={categoriesQuery.isPending || profileQuery.isPending}
      isSessionsPending={sessionsQuery.isPending}
      providers={capabilitiesQuery.data?.oauth}
      section={section}
      serverLines={profileQuery.data?.lines}
      sessions={sessionsQuery.data}
    />
  );
};
