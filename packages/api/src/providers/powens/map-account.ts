import { Predicate } from "effect";

import { refineAccountTypeByName } from "../../lib/account-types";
import type { ProviderAccount, ProviderAccountType } from "../types";
import type { PowensAccount, PowensAccountType } from "./client";
import { isReported, precisionOf, toIsoDateTime, toMinorUnits } from "./client";

const ACCOUNT_TYPE_MAP = {
  article83: "RETIREMENT",
  capitalisation: "LIFE_INSURANCE",
  card: "CARD",
  cat: "TERM_DEPOSIT",
  cel: "CEL",
  checking: "CHECKING",
  crowdlending: "CROWDLENDING",
  csl: "SAVINGS",
  deposit: "SAVINGS",
  joint: "CHECKING",
  ldds: "LDDS",
  lep: "LEP",
  lifeinsurance: "LIFE_INSURANCE",
  livret_a: "LIVRET_A",
  livret_b: "SAVINGS",
  loan: "LOAN",
  madelin: "RETIREMENT",
  market: "BROKERAGE",
  pea: "PEA",
  pee: "EMPLOYEE_SAVINGS",
  pel: "PEL",
  per: "RETIREMENT",
  perco: "RETIREMENT",
  perp: "RETIREMENT",
  real_estate: "REAL_ESTATE",
  rsp: "EMPLOYEE_SAVINGS",
  savings: "SAVINGS",
} satisfies Record<string, ProviderAccountType>;

const isKnownAccountType = (
  name: string
): name is keyof typeof ACCOUNT_TYPE_MAP =>
  Object.hasOwn(ACCOUNT_TYPE_MAP, name);

const accountTypeName = (type: PowensAccountType | null | undefined): string =>
  Predicate.isString(type) ? type : (type?.name ?? "");

export const mapPowensAccount = (account: PowensAccount): ProviderAccount => {
  const precision = precisionOf(account);
  const { balance } = account;
  const typeName = accountTypeName(account.type);
  const name = account.name ?? account.original_name ?? undefined;

  return {
    balanceAt: toIsoDateTime(account.last_update),
    balanceMinor: isReported(balance)
      ? toMinorUnits(balance, precision)
      : undefined,
    currency: account.currency?.id ?? undefined,
    iban: account.iban ?? undefined,
    name,
    providerAccountId: String(account.id),
    type: refineAccountTypeByName(
      isKnownAccountType(typeName) ? ACCOUNT_TYPE_MAP[typeName] : "UNKNOWN",
      [account.original_name ?? undefined, account.name ?? undefined]
    ),
  };
};
