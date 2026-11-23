import { refineAccountTypeByName } from "../../lib/account-types";
import type { CompletedConnection, ProviderAccountType } from "../types";
import type { EBCompletedConnection } from "./client";

const CASH_ACCOUNT_TYPE_MAP = {
  CACC: "CHECKING",
  CARD: "CARD",
  CASH: "CHECKING",
  LOAN: "LOAN",
  SVGS: "SAVINGS",
} satisfies Record<string, ProviderAccountType>;

const isKnownCashAccountType = (
  code: string
): code is keyof typeof CASH_ACCOUNT_TYPE_MAP =>
  Object.hasOwn(CASH_ACCOUNT_TYPE_MAP, code);

const accountTypeOf = (
  account: EBCompletedConnection["accounts"][number]
): ProviderAccountType => {
  const code = account.cash_account_type ?? "";

  return refineAccountTypeByName(
    isKnownCashAccountType(code) ? CASH_ACCOUNT_TYPE_MAP[code] : "UNKNOWN",
    [account.product ?? undefined, account.name]
  );
};

export const mapEBCompletedConnection = (
  connection: EBCompletedConnection
): CompletedConnection => ({
  accounts: connection.accounts.map((account) => ({
    iban: account.account_id?.iban,
    identificationHash: account.account_id?.identification_hash,
    name: account.name,
    providerAccountId: account.uid,
    type: accountTypeOf(account),
  })),
  institutionGroup: connection.aspsp?.group ?? undefined,
  institutionName: connection.aspsp?.name ?? "",
  providerSessionId: connection.session_id,
});
