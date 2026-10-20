import type { CompletedConnection } from "../types";
import type { PowensConnection } from "./client";

export const mapPowensConnection = (
  connection: PowensConnection
): CompletedConnection => ({
  accounts: (connection.accounts ?? []).flatMap((account) =>
    account.deleted
      ? []
      : [
          {
            iban: account.iban ?? undefined,
            name: account.name ?? account.original_name ?? undefined,
            providerAccountId: String(account.id),
          },
        ]
  ),
  institutionName: connection.connector?.name ?? "",
  providerSessionId: String(connection.id),
});
