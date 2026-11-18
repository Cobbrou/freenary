import type { ProviderAccountType } from "../providers/types";
import { PROVIDER_ACCOUNT_TYPES } from "../providers/types";
import type { SpendingCategory } from "./taxonomy";

export const ASSET_CLASSES = [
  "cash",
  "savings",
  "investments",
  "retirement",
  "property",
  "other",
] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];

export const SAVING_CATEGORIES = [
  "retirement",
  "savings",
  "securities",
] as const satisfies readonly SpendingCategory[];

export type SavingCategory = (typeof SAVING_CATEGORIES)[number];

export interface AccountTypeRule {
  assetClass: AssetClass | null;
  countsInAvailableBalance: boolean;
  countsInCashFlow: boolean;
  holdsPositions: boolean;
  isDebt: boolean;
  pairsInternalTransfers: boolean;
  savingCategory: SavingCategory | null;
}

const EVERYDAY = {
  assetClass: "cash",
  countsInAvailableBalance: true,
  countsInCashFlow: true,
  holdsPositions: false,
  isDebt: false,
  pairsInternalTransfers: true,
  savingCategory: null,
} as const satisfies AccountTypeRule;

const setAside = (
  assetClass: AssetClass,
  savingCategory: SavingCategory,
  holdsPositions: boolean
): AccountTypeRule => ({
  assetClass,
  countsInAvailableBalance: false,
  countsInCashFlow: false,
  holdsPositions,
  isDebt: false,
  pairsInternalTransfers: true,
  savingCategory,
});

const SAVINGS = setAside("savings", "savings", false);
const INVESTMENTS = setAside("investments", "securities", true);
const RETIREMENT = setAside("retirement", "retirement", true);

export const ACCOUNT_TYPE_RULES = {
  BROKERAGE: INVESTMENTS,
  CARD: { ...EVERYDAY, assetClass: null, isDebt: true },
  CEL: SAVINGS,
  CHECKING: EVERYDAY,
  CROWDLENDING: INVESTMENTS,
  EMPLOYEE_SAVINGS: RETIREMENT,
  LDDS: SAVINGS,
  LEP: SAVINGS,
  LIFE_INSURANCE: setAside("investments", "savings", true),
  LIVRET_A: SAVINGS,
  LOAN: {
    assetClass: null,
    countsInAvailableBalance: false,
    countsInCashFlow: false,
    holdsPositions: false,
    isDebt: true,
    pairsInternalTransfers: false,
    savingCategory: null,
  },
  PEA: INVESTMENTS,
  PEL: SAVINGS,
  REAL_ESTATE: setAside("property", "securities", true),
  RETIREMENT,
  SAVINGS,
  TERM_DEPOSIT: SAVINGS,
  UNKNOWN: {
    assetClass: "other",
    countsInAvailableBalance: false,
    countsInCashFlow: true,
    holdsPositions: false,
    isDebt: false,
    pairsInternalTransfers: true,
    savingCategory: null,
  },
} as const satisfies Record<ProviderAccountType, AccountTypeRule>;

const isAccountType = (type: string): type is ProviderAccountType =>
  Object.hasOwn(ACCOUNT_TYPE_RULES, type);

export const accountTypeRule = (type: string): AccountTypeRule =>
  isAccountType(type) ? ACCOUNT_TYPE_RULES[type] : ACCOUNT_TYPE_RULES.UNKNOWN;

const typesWhere = (
  rule: (accountRule: AccountTypeRule) => boolean
): ProviderAccountType[] =>
  PROVIDER_ACCOUNT_TYPES.filter((type) => rule(ACCOUNT_TYPE_RULES[type]));

export const CASH_FLOW_ACCOUNT_TYPES = typesWhere(
  (rule) => rule.countsInCashFlow
);

export const INTERNAL_TRANSFER_ACCOUNT_TYPES = typesWhere(
  (rule) => rule.pairsInternalTransfers
);

export const cashFlowAccountsOf = (userId: string) => ({
  connection: { userId },
  type: { in: CASH_FLOW_ACCOUNT_TYPES },
});

export const cashFlowAccountTypesSql = (column: string): string =>
  `${column}::text IN (${CASH_FLOW_ACCOUNT_TYPES.map((type) => `'${type}'`).join(", ")})`;

export const savingCategoriesSql = (column: string): string =>
  `${column} IN (${SAVING_CATEGORIES.map((category) => `'${category}'`).join(", ")})`;

export const signedBalanceOf = (type: string, balanceMinor: number): number =>
  accountTypeRule(type).isDebt ? -Math.abs(balanceMinor) : balanceMinor;

const REFINABLE_TYPES = new Set<ProviderAccountType>(["SAVINGS", "UNKNOWN"]);

const NAMED_PRODUCTS: readonly [RegExp, ProviderAccountType][] = [
  [/ (?:livret a|livret bleu) /u, "LIVRET_A"],
  [
    / (?:ldds?|livret (?:de )?developpement durable(?: et solidaire)?) /u,
    "LDDS",
  ],
  [/ (?:lep|livret (?:d )?epargne populaire) /u, "LEP"],
  [/ (?:pel|plan (?:d )?epargne logement) /u, "PEL"],
  [/ (?:cel|compte (?:d )?epargne logement) /u, "CEL"],
  [/ (?:pea(?: pme)?|plan (?:d )?epargne en actions) /u, "PEA"],
  [/ (?:cat|compte a terme|depot a terme) /u, "TERM_DEPOSIT"],
];

const COMBINING_MARKS = /\p{M}/gu;

const NOT_ALPHANUMERIC = /[^a-z0-9]+/gu;

const searchableName = (name: string): string =>
  ` ${name
    .normalize("NFD")
    .replaceAll(COMBINING_MARKS, "")
    .toLowerCase()
    .replaceAll(NOT_ALPHANUMERIC, " ")
    .trim()} `;

export const refineAccountTypeByName = (
  type: ProviderAccountType,
  names: readonly (string | undefined)[]
): ProviderAccountType => {
  if (!REFINABLE_TYPES.has(type)) {
    return type;
  }

  for (const name of names) {
    if (name) {
      const searchable = searchableName(name);
      const match = NAMED_PRODUCTS.find(([pattern]) =>
        pattern.test(searchable)
      );

      if (match) {
        return match[1];
      }
    }
  }

  return type;
};
