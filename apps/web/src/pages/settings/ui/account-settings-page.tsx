import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@freenary/ui/components/item";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { Switch } from "@freenary/ui/components/switch";
import { RiArrowLeftSLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useId } from "react";

import { ACCOUNT_TYPE_LABELS, accountName } from "@/entities/account";
import type { PortfolioAccount } from "@/entities/account";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { orpc } from "@/shared/api";
import { ExclusionReasonField } from "@/shared/ui/exclusion-reason-field";

import { operatorStandingOf } from "../model/settings-nav-items";
import { useAccountExclusion } from "../model/use-account-exclusion";
import { AccountRename } from "./account-rename";
import { SettingsNav } from "./settings-nav";
import {
  SettingsList,
  SettingsPane,
  SettingsSection,
} from "./settings-section";

const maskIban = (iban: string | null | undefined) => {
  if (!iban) {
    return "—";
  }

  const compact = iban.replaceAll(/\s/gu, "");

  return `${compact.slice(0, 4)} •••• ${compact.slice(-4)}`;
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="border-border flex items-baseline justify-between gap-6 py-2.5 not-first:border-t">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-end break-words tabular-nums">{value}</dd>
  </div>
);

const DisplaySection = ({ account }: { account: PortfolioAccount }) => {
  const exclusion = useAccountExclusion(account);
  const labelId = useId();
  const descriptionId = useId();

  return (
    <SettingsSection
      description={m.settings_bank_account_display_description()}
      title={m.settings_bank_account_display_title()}
    >
      <SettingsList>
        <Item size="sm">
          <ItemContent>
            <ItemTitle>{m.bank_account_rename_label()}</ItemTitle>
            <ItemDescription className="break-words">
              {accountName(account)}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <AccountRename account={account} />
          </ItemActions>
        </Item>
        <Item size="sm">
          <ItemContent>
            <ItemTitle id={labelId}>{m.bank_account_exclude_label()}</ItemTitle>
            <ItemDescription className="text-pretty" id={descriptionId}>
              {m.bank_account_excluded_description()}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Switch
              aria-describedby={descriptionId}
              aria-labelledby={labelId}
              checked={exclusion.isExcluded}
              disabled={exclusion.isPending}
              onCheckedChange={(next) => exclusion.mutate({ isExcluded: next })}
            />
          </ItemActions>
        </Item>
      </SettingsList>
      {exclusion.isExcluded ? (
        <ExclusionReasonField
          className="max-w-md"
          disabled={exclusion.isPending}
          key={account.id}
          onSave={(reason) => exclusion.mutate({ isExcluded: true, reason })}
          reason={exclusion.reason}
        />
      ) : null}
    </SettingsSection>
  );
};

const AccountSettingsContent = ({ account }: { account: PortfolioAccount }) => {
  const connections = useQuery(
    orpc.bankConnection.listConnections.queryOptions()
  );

  const connection = connections.data?.connections.find((candidate) =>
    candidate.accounts.some((held) => held.id === account.id)
  );

  const iban = connection?.accounts.find(
    (held) => held.id === account.id
  )?.iban;

  const lastSynced = connection?.lastSyncedAt
    ? new Intl.DateTimeFormat(getLocale(), {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(connection.lastSyncedAt))
    : "—";

  return (
    <SettingsPane
      description={m.home_accounts_meta({
        institution: account.institutionName,
        type: ACCOUNT_TYPE_LABELS[account.type](),
      })}
      title={accountName(account)}
    >
      <SettingsSection
        description={m.settings_bank_account_details_description()}
        title={m.settings_bank_account_details_title()}
      >
        <dl className="flex flex-col">
          <DetailRow
            label={m.settings_bank_account_detail_name()}
            value={account.bankName ?? ACCOUNT_TYPE_LABELS[account.type]()}
          />
          <DetailRow
            label={m.settings_bank_account_detail_institution()}
            value={account.institutionName}
          />
          <DetailRow
            label={m.settings_bank_account_detail_type()}
            value={ACCOUNT_TYPE_LABELS[account.type]()}
          />
          <DetailRow
            label={m.settings_bank_account_detail_currency()}
            value={account.currency ?? "—"}
          />
          <DetailRow
            label={m.settings_bank_account_detail_iban()}
            value={maskIban(iban)}
          />
          <DetailRow
            label={m.settings_bank_account_detail_last_synced()}
            value={lastSynced}
          />
        </dl>
      </SettingsSection>

      <DisplaySection account={account} />
    </SettingsPane>
  );
};

export const AccountSettingsPage = () => {
  const { accountId } = useParams({
    from: "/_auth/settings_/bank-accounts/$accountId",
  });

  const overview = useQuery(orpc.portfolio.getOverview.queryOptions());
  const instanceStatus = useQuery(orpc.instance.status.queryOptions());
  const account = overview.data?.accounts.find(
    (candidate) => candidate.id === accountId
  );

  const renderContent = () => {
    if (overview.isPending) {
      return <Skeleton className="h-40 w-full" />;
    }

    if (!account) {
      return (
        <p className="text-muted-foreground text-sm">
          {m.bank_account_missing_title()}
        </p>
      );
    }

    return <AccountSettingsContent account={account} />;
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pb-20 lg:flex-row lg:gap-10">
      <SettingsNav
        section="bank-accounts"
        standing={operatorStandingOf({
          isOperator: instanceStatus.data?.isOperator,
          isPending: instanceStatus.isPending,
        })}
      />

      <div className="flex max-w-3xl min-w-0 flex-1 flex-col gap-3">
        <Link
          className="text-muted-foreground hover:text-foreground -ms-1 inline-flex w-fit items-center gap-0.5 text-xs transition-colors"
          search={{ section: "bank-accounts" }}
          to="/settings"
        >
          <RiArrowLeftSLine aria-hidden="true" className="size-4" />
          {m.settings_tab_bank_accounts()}
        </Link>
        {renderContent()}
      </div>
    </div>
  );
};
