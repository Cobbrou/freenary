import { ACCOUNT_TYPE_LABELS } from "@/entities/account";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { countryName } from "@/shared/lib/countries";

import type { BankConnection, BankInstitution } from "./use-bank-connections";

export type ConnectedAccount = BankConnection["accounts"][number];

export interface BankRow {
  connection: BankConnection | null;
  description: string | null;
  id: string;
  institution: BankInstitution | null;
  logo: string | null;
  name: string;
}

export const institutionKey = (institution: {
  country: string | null;
  id: string;
}): string => `${institution.country ?? ""}:${institution.id}`;

const IBAN_TAIL_LENGTH = 4;

export const connectedAccountLabel = (account: ConnectedAccount): string => {
  const name = account.name ?? ACCOUNT_TYPE_LABELS[account.type]();
  const iban = account.iban?.replaceAll(" ", "");

  return iban ? `${name} ·· ${iban.slice(-IBAN_TAIL_LENGTH)}` : name;
};

export const notSharedAccountsOf = (
  connection: BankConnection
): ConnectedAccount[] =>
  connection.accounts.filter((account) => !account.inConsent);

export const accountsOf = (connection: BankConnection): ConnectedAccount[] => [
  ...connection.accounts.filter((account) => account.inConsent),
  ...notSharedAccountsOf(connection),
];

const accountsSummaryOf = (
  connection: BankConnection,
  locale: Locale
): string => {
  const notShared = notSharedAccountsOf(connection).length;
  const shared = connection.accounts.length - notShared;

  if (notShared === 0) {
    return m.bank_account({ count: shared }, { locale });
  }

  return shared === 0
    ? m.bank_row_no_account_shared({ count: notShared }, { locale })
    : m.bank_row_accounts_not_shared(
        {
          accounts: m.bank_account({ count: shared }, { locale }),
          count: notShared,
        },
        { locale }
      );
};

const summaryOf = (connection: BankConnection, locale: Locale): string => {
  const accounts = accountsSummaryOf(connection, locale);

  if (connection.status !== "ACTIVE") {
    return m.bank_row_reconnect({ accounts }, { locale });
  }

  return connection.lastSyncedAt
    ? m.bank_row_synced(
        { accounts, date: connection.lastSyncedAt.toLocaleDateString(locale) },
        { locale }
      )
    : m.bank_row_never_synced({ accounts }, { locale });
};

export const buildBankRows = (
  banks: BankInstitution[],
  connections: BankConnection[],
  locale: Locale
): BankRow[] => {
  const institutionsByKey = new Map(
    banks.map((bank) => [institutionKey(bank), bank])
  );

  const connectedKeys = new Set(
    connections.flatMap((connection) =>
      connection.institutionId === null
        ? []
        : [
            institutionKey({
              country: connection.institutionCountry,
              id: connection.institutionId,
            }),
          ]
    )
  );

  const spansCountries = new Set(banks.map((bank) => bank.country)).size > 1;

  const connectedRows = connections.map((connection) => {
    const institution = connection.institutionId
      ? (institutionsByKey.get(
          institutionKey({
            country: connection.institutionCountry,
            id: connection.institutionId,
          })
        ) ?? null)
      : null;

    return {
      connection,
      description: summaryOf(connection, locale),
      id: connection.id,
      institution,
      logo: institution?.logo ?? null,
      name: institution?.name ?? connection.institutionName,
    };
  });

  const unconnectedRows = banks.flatMap((bank) => {
    if (connectedKeys.has(institutionKey(bank))) {
      return [];
    }

    const origin = spansCountries ? countryName(bank.country, locale) : null;

    return [
      {
        connection: null,
        description:
          origin && bank.bic ? `${origin} · ${bank.bic}` : (origin ?? bank.bic),
        id: institutionKey(bank),
        institution: bank,
        logo: bank.logo,
        name: bank.name,
      },
    ];
  });

  return [...connectedRows, ...unconnectedRows];
};
