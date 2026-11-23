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
import { useEffect } from "react";
import type { ReactNode } from "react";

import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";
import { useOauthCallbackError } from "@/shared/auth";
import { DEFAULT_SETTINGS_SECTION } from "@/shared/config";
import type { SettingsSection } from "@/shared/config";

import {
  authAccountsQueryOptions,
  authSessionsQueryOptions,
  CREDENTIAL_PROVIDER_ID,
} from "../api/auth-queries";
import type { LinkedAccount, UserSession } from "../api/auth-queries";
import {
  isSectionShownTo,
  operatorStandingOf,
} from "../model/settings-nav-items";
import type { OperatorStanding } from "../model/settings-nav-items";
import { useBudgetProfileEditor } from "../model/use-budget-profile-editor";
import type { ServerBudgetProfile } from "../model/use-budget-profile-editor";
import {
  AppearanceLocaleSection,
  AppearanceThemeSection,
} from "./appearance-section";
import { BankAccountsSection } from "./bank-accounts-section";
import { BudgetingSection } from "./budgeting-section";
import { CategoriesSection } from "./categories-section";
import { SecurityAccountsSection } from "./security-accounts-section";
import type { OAuthProviderOption } from "./security-accounts-section";
import { SecurityApiKeysSection } from "./security-api-keys-section";
import { SecurityPasskeysSection } from "./security-passkeys-section";
import { SecuritySessionsSection } from "./security-sessions-section";
import { SecurityTwoFactorSection } from "./security-two-factor-section";
import { ServicesPane } from "./services-pane";
import { SettingsNav } from "./settings-nav";
import { SettingsPane } from "./settings-section";
import { UnsavedChangesBar } from "./unsaved-changes-bar";

interface SignInPaneProps {
  accounts: LinkedAccount[] | undefined;
  isAccountsPending: boolean;
  providers: OAuthProviderOption[] | undefined;
}

interface SettingsContentProps extends SignInPaneProps {
  budgetLoadError: ReactNode;
  categories: CategoryEntry[];
  categoriesLoadError: ReactNode;
  isCategoriesPending: boolean;
  isPending: boolean;
  isSessionsPending: boolean;
  operatorStanding: OperatorStanding;
  section: SettingsSection;
  serverProfile: ServerBudgetProfile | undefined;
  sessions: UserSession[] | undefined;
}

interface LoadErrorProps {
  isRetrying: boolean;
  onRetry: () => void;
}

const LoadError = ({ isRetrying, onRetry }: LoadErrorProps) => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <RiErrorWarningLine />
      </EmptyMedia>
      <EmptyTitle>{m.settings_budget_load_error_title()}</EmptyTitle>
    </EmptyHeader>
    <EmptyContent>
      <Button loading={isRetrying} onClick={onRetry} variant="tertiary">
        {m.settings_retry()}
      </Button>
    </EmptyContent>
  </Empty>
);

const AppearancePane = () => (
  <SettingsPane
    description={m.settings_tab_appearance_description()}
    title={m.settings_tab_appearance()}
  >
    <AppearanceThemeSection />

    <AppearanceLocaleSection />
  </SettingsPane>
);

const SignInPane = ({
  accounts,
  isAccountsPending,
  providers,
}: SignInPaneProps) => (
  <SettingsPane
    description={m.settings_tab_sign_in_description()}
    title={m.settings_tab_sign_in()}
  >
    <SecurityTwoFactorSection
      hasPassword={accounts?.some(
        (account) => account.providerId === CREDENTIAL_PROVIDER_ID
      )}
      isAccountsPending={isAccountsPending}
    />

    <SecurityPasskeysSection />

    <SecurityAccountsSection
      accounts={accounts}
      isPending={isAccountsPending}
      providers={providers}
    />
  </SettingsPane>
);

const SettingsContent = ({
  accounts,
  budgetLoadError,
  categories,
  categoriesLoadError,
  isAccountsPending,
  isCategoriesPending,
  isPending,
  isSessionsPending,
  operatorStanding,
  providers,
  section,
  serverProfile,
  sessions,
}: SettingsContentProps) => {
  const editor = useBudgetProfileEditor(serverProfile, categories);
  const navigate = useNavigate();
  const isShown = isSectionShownTo(section, operatorStanding);
  const isHiddenFromThisAccount = !isShown && operatorStanding === "member";

  useEffect(() => {
    if (isHiddenFromThisAccount) {
      void navigate({
        replace: true,
        search: { section: DEFAULT_SETTINGS_SECTION },
        to: "/settings",
      });
    }
  }, [isHiddenFromThisAccount, navigate]);

  const panes = {
    "api-keys": <SecurityApiKeysSection />,
    appearance: <AppearancePane />,
    "bank-accounts": <BankAccountsSection />,
    budget: (
      <BudgetingSection
        addLine={editor.addLine}
        categories={categories}
        currency={editor.currency}
        errors={editor.errors}
        isPending={isPending}
        lines={editor.lines}
        loadError={budgetLoadError}
        moveLine={editor.moveLine}
        removeLine={editor.removeLine}
        reorderLines={editor.reorderLines}
        updateLine={editor.updateLine}
      />
    ),
    categories: (
      <CategoriesSection
        categories={categories}
        isPending={isCategoriesPending}
        loadError={categoriesLoadError}
      />
    ),
    services: <ServicesPane />,
    sessions: (
      <SecuritySessionsSection
        isPending={isSessionsPending}
        sessions={sessions}
      />
    ),
    "sign-in": (
      <SignInPane
        accounts={accounts}
        isAccountsPending={isAccountsPending}
        providers={providers}
      />
    ),
  } satisfies Record<SettingsSection, ReactNode>;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pb-20 lg:flex-row lg:gap-10">
      <SettingsNav section={section} standing={operatorStanding} />

      <div className="flex max-w-3xl min-w-0 flex-1 flex-col">
        {isShown ? panes[section] : null}
      </div>

      <UnsavedChangesBar
        changeCount={editor.changeCount}
        hasErrors={editor.errors.size > 0}
        isSaving={editor.isSaving}
        onCancel={() => editor.reset()}
        onReview={
          section === "budget"
            ? undefined
            : () => {
                void navigate({
                  search: { section: "budget" },
                  to: "/settings",
                });
              }
        }
        onSave={() => editor.save()}
      />
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

  const retryBudget = () => {
    void categoriesQuery.refetch();
    void profileQuery.refetch();
  };

  const categoriesLoadError = categoriesQuery.isError ? (
    <LoadError
      isRetrying={categoriesQuery.isFetching}
      onRetry={() => {
        void categoriesQuery.refetch();
      }}
    />
  ) : null;

  const budgetLoadError =
    categoriesQuery.isError || profileQuery.isError ? (
      <LoadError
        isRetrying={categoriesQuery.isFetching || profileQuery.isFetching}
        onRetry={retryBudget}
      />
    ) : null;

  return (
    <SettingsContent
      accounts={accountsQuery.data}
      budgetLoadError={budgetLoadError}
      categories={categoriesQuery.data?.categories ?? []}
      categoriesLoadError={categoriesLoadError}
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
      serverProfile={profileQuery.data}
      sessions={sessionsQuery.data}
    />
  );
};
