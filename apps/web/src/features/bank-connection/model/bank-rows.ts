import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { countryName } from "@/shared/lib/countries";

import type { BankConnection, BankInstitution } from "./use-bank-connections";

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

const summaryOf = (connection: BankConnection, locale: Locale): string => {
  const accounts = m.bank_account(
    { count: connection.accounts.length },
    { locale }
  );

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
