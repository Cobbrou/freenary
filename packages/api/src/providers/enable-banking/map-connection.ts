import { refineAccountTypeByName } from "../../lib/account-types";
import { minorUnitDigits } from "../../lib/money";
import type {
  CompletedConnection,
  ProviderAccount,
  ProviderAccountType,
  ProviderBalance,
} from "../types";
import type {
  EBAccountDetails,
  EBBalance,
  EBCompletedConnection,
} from "./client";
import { parseMinorUnits } from "./map-transaction";

interface EBAccountKind {
  cash_account_type?: string | null;
  name?: string | null;
  product?: string | null;
}

const CASH_ACCOUNT_TYPE_MAP = {
  CACC: "CHECKING",
  CARD: "CARD",
  CASH: "CHECKING",
  LOAN: "LOAN",
  SVGS: "SAVINGS",
} satisfies Record<string, ProviderAccountType>;

const MULTI_CURRENCY_CODE = "XXX";

const BALANCE_TYPE_PREFERENCE: readonly string[] = [
  "CLBD",
  "ITBD",
  "XPCD",
  "ITAV",
  "CLAV",
  "OPBD",
];

const CREDIT_INDICATOR = "CRDT";

const isKnownCashAccountType = (
  code: string
): code is keyof typeof CASH_ACCOUNT_TYPE_MAP =>
  Object.hasOwn(CASH_ACCOUNT_TYPE_MAP, code);

const accountTypeOf = (account: EBAccountKind): ProviderAccountType => {
  const code = account.cash_account_type ?? "";

  return refineAccountTypeByName(
    isKnownCashAccountType(code) ? CASH_ACCOUNT_TYPE_MAP[code] : "UNKNOWN",
    [account.product ?? undefined, account.name ?? undefined]
  );
};

const singleCurrencyOf = (
  currency: string | null | undefined
): string | undefined =>
  currency && currency !== MULTI_CURRENCY_CODE ? currency : undefined;

export const mapEBCompletedConnection = (
  connection: EBCompletedConnection
): CompletedConnection => ({
  accounts: connection.accounts.map((account) => ({
    currency: singleCurrencyOf(account.currency),
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

const preferenceRank = (balance: EBBalance): number => {
  const rank = BALANCE_TYPE_PREFERENCE.indexOf(balance.balance_type ?? "");

  return rank === -1 ? BALANCE_TYPE_PREFERENCE.length : rank;
};

const toProviderBalance = (balance: EBBalance): ProviderBalance => {
  const { amount, currency } = balance.balance_amount;

  return {
    balanceAt:
      balance.last_change_date_time ?? balance.reference_date ?? undefined,
    balanceMinor: parseMinorUnits(
      amount,
      CREDIT_INDICATOR,
      minorUnitDigits(currency)
    ),
    currency,
  };
};

export const pickBalancePerCurrency = (
  balances: readonly EBBalance[]
): ProviderBalance[] => {
  const preferred = new Map<string, EBBalance>();

  for (const balance of balances) {
    const { currency } = balance.balance_amount;
    const kept = preferred.get(currency);

    if (!kept || preferenceRank(balance) < preferenceRank(kept)) {
      preferred.set(currency, balance);
    }
  }

  return [...preferred.values()].map(toProviderBalance);
};

export const mapEBAccount = (
  uid: string,
  details: EBAccountDetails,
  balances: readonly EBBalance[] | null
): ProviderAccount => {
  const base = {
    iban: details.account_id?.iban ?? undefined,
    name: details.name ?? undefined,
    providerAccountId: uid,
    type: accountTypeOf(details),
  };

  const accountCurrency = singleCurrencyOf(details.currency);

  if (!balances) {
    return { ...base, currency: accountCurrency };
  }

  const picked = pickBalancePerCurrency(balances);
  const currency = accountCurrency ?? picked[0]?.currency;
  const main = picked.find((balance) => balance.currency === currency);

  return {
    ...base,
    balanceAt: main?.balanceAt,
    balanceMinor: main?.balanceMinor,
    balances: picked,
    currency,
  };
};
