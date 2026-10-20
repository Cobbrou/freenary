import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@freenary/ui/components/alert-dialog";
import { Badge } from "@freenary/ui/components/badge";
import { Button } from "@freenary/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@freenary/ui/components/item";
import {
  useFluidHover,
  useRegisterFluidHoverItem,
} from "@freenary/ui/hooks/use-fluid-hover";
import { useMemo, useRef } from "react";
import type { ReactNode } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

import { CREDENTIAL_PROVIDER_ID } from "../api/auth-queries";
import type { LinkedAccount } from "../api/auth-queries";
import { useLinkedAccountActions } from "../model/use-linked-account-actions";
import { SecurityRowsSkeleton } from "./security-rows-skeleton";
import { SettingsRowList } from "./settings-row-list";
import { SettingsSection } from "./settings-section";

interface ProviderRow {
  isRetiredButStillLinked: boolean;
  label: string;
  linkedAccountId: string | null;
  providerId: string;
}

export interface OAuthProviderOption {
  id: string;
  name: string | null;
}

interface DisconnectProviderDialogProps {
  isDisconnecting: boolean;
  label: string;
  onConfirm: () => void;
}

interface AccountRowProps {
  children: ReactNode;
  index: number;
  registerItem: (index: number, element: HTMLElement | null) => void;
}

interface SecurityAccountsSectionProps {
  accounts: LinkedAccount[] | undefined;
  isPending: boolean;
  providers: OAuthProviderOption[] | undefined;
}

const AccountRow = ({ children, index, registerItem }: AccountRowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);

  useRegisterFluidHoverItem(registerItem, index, rowRef);

  return (
    <Item className="relative z-10" ref={rowRef} render={<li />} size="sm">
      {children}
    </Item>
  );
};

const LABELS_FOR_PROVIDERS_THE_APP_NAMES_ITSELF = {
  apple: m.settings_accounts_provider_apple,
  google: m.settings_accounts_provider_google,
  oidc: m.settings_accounts_provider_sso,
} satisfies Record<string, () => string>;

const providerLabel = (providerId: string): string | null => {
  if (!Object.hasOwn(LABELS_FOR_PROVIDERS_THE_APP_NAMES_ITSELF, providerId)) {
    return null;
  }

  // SAFETY: hasOwn just proved providerId is one of this object's keys.
  return LABELS_FOR_PROVIDERS_THE_APP_NAMES_ITSELF[
    providerId as keyof typeof LABELS_FOR_PROVIDERS_THE_APP_NAMES_ITSELF
  ]();
};

const toLinkedRow = (account: LinkedAccount): ProviderRow => ({
  isRetiredButStillLinked: false,
  label: providerLabel(account.providerId) ?? account.providerId,
  linkedAccountId: account.id,
  providerId: account.providerId,
});

const buildProviderRows = (
  linkedOauth: LinkedAccount[],
  offeredProviders: OAuthProviderOption[] | undefined
): ProviderRow[] => {
  if (offeredProviders === undefined) {
    return linkedOauth.map(toLinkedRow);
  }

  const offered = offeredProviders.map((provider) => ({
    isRetiredButStillLinked: false,
    label: provider.name ?? providerLabel(provider.id) ?? provider.id,
    linkedAccountId:
      linkedOauth.find((account) => account.providerId === provider.id)?.id ??
      null,
    providerId: provider.id,
  }));

  const retiredButStillLinked = linkedOauth.flatMap((account) =>
    offeredProviders.some((provider) => provider.id === account.providerId)
      ? []
      : [{ ...toLinkedRow(account), isRetiredButStillLinked: true }]
  );

  return [...offered, ...retiredButStillLinked];
};

const DisconnectProviderDialog = ({
  isDisconnecting,
  label,
  onConfirm,
}: DisconnectProviderDialogProps) => (
  <AlertDialog>
    <AlertDialogTrigger
      render={
        <Button
          aria-label={m.settings_accounts_disconnect_provider({
            provider: label,
          })}
          variant="ghost"
        />
      }
    >
      {m.settings_accounts_disconnect()}
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {m.settings_accounts_disconnect_title({ provider: label })}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {m.settings_accounts_disconnect_description()}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{m.settings_cancel()}</AlertDialogCancel>
        <AlertDialogAction
          className="text-destructive hover:text-destructive"
          loading={isDisconnecting}
          onClick={onConfirm}
          variant="ghost"
        >
          {m.settings_accounts_disconnect_confirm()}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export const SecurityAccountsSection = ({
  accounts,
  isPending,
  providers,
}: SecurityAccountsSectionProps) => {
  const { connect, connectingProvider, disconnect, disconnectingId } =
    useLinkedAccountActions();

  const listRef = useRef<HTMLUListElement>(null);
  const hover = useFluidHover(listRef, { axis: "y", gapClick: false });

  const locale = getLocale();
  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale]
  );

  const passwordAccount = accounts?.find(
    (account) => account.providerId === CREDENTIAL_PROVIDER_ID
  );

  const rows = useMemo<ProviderRow[]>(() => {
    const linkedOauth = (accounts ?? []).filter(
      (account) => account.providerId !== CREDENTIAL_PROVIDER_ID
    );

    return buildProviderRows(linkedOauth, providers);
  }, [accounts, providers]);

  const renderRows = () => {
    if (isPending) {
      return (
        <SecurityRowsSkeleton loadingLabel={m.settings_accounts_loading()} />
      );
    }

    if (accounts === undefined) {
      return (
        <p className="text-muted-foreground">
          {m.settings_accounts_load_error()}
        </p>
      );
    }

    return (
      <>
        {passwordAccount === undefined && (
          <p className="text-muted-foreground">
            {m.settings_accounts_no_password_note()}
          </p>
        )}

        {providers === undefined && (
          <p className="text-muted-foreground">
            {m.settings_accounts_providers_load_error()}
          </p>
        )}

        {(passwordAccount !== undefined || rows.length > 0) && (
          <SettingsRowList hover={hover} ref={listRef}>
            {passwordAccount === undefined ? null : (
              <AccountRow index={0} registerItem={hover.registerItem}>
                <ItemContent className="min-w-0">
                  <ItemTitle>{m.settings_accounts_password()}</ItemTitle>
                  <ItemDescription>
                    {m.settings_accounts_added({
                      date: formatter.format(passwordAccount.createdAt),
                    })}
                  </ItemDescription>
                </ItemContent>
              </AccountRow>
            )}

            {rows.map((row, position) => (
              <AccountRow
                index={(passwordAccount === undefined ? 0 : 1) + position}
                key={row.providerId}
                registerItem={hover.registerItem}
              >
                <ItemContent className="min-w-0">
                  <ItemTitle className="flex flex-wrap items-center gap-2">
                    {row.label}
                    {row.linkedAccountId === null ? null : (
                      <Badge>{m.settings_accounts_connected()}</Badge>
                    )}
                  </ItemTitle>
                  {row.isRetiredButStillLinked && (
                    <ItemDescription>
                      {m.settings_accounts_provider_retired()}
                    </ItemDescription>
                  )}
                </ItemContent>

                <ItemActions>
                  {row.linkedAccountId === null ? (
                    <Button
                      aria-label={m.settings_accounts_connect_provider({
                        provider: row.label,
                      })}
                      loading={connectingProvider === row.providerId}
                      onClick={() => connect(row.providerId)}
                      variant="tertiary"
                    >
                      {m.settings_accounts_connect()}
                    </Button>
                  ) : (
                    <DisconnectProviderDialog
                      isDisconnecting={disconnectingId === row.linkedAccountId}
                      label={row.label}
                      onConfirm={() => {
                        if (row.linkedAccountId !== null) {
                          disconnect(row.linkedAccountId);
                        }
                      }}
                    />
                  )}
                </ItemActions>
              </AccountRow>
            ))}
          </SettingsRowList>
        )}
      </>
    );
  };

  return (
    <SettingsSection
      description={m.settings_accounts_description()}
      title={m.settings_accounts_title()}
    >
      {renderRows()}
    </SettingsSection>
  );
};
