import { splitFullName } from "@freenary/auth/person-name";
import type { Prisma } from "@freenary/db";
import { z } from "zod";

import { PROVIDER_ACCOUNT_TYPES } from "../providers/types";

export const DATA_EXPORT_FORMAT = "freenary-export";
export const DATA_EXPORT_VERSION = 2;

const SINGLE_NAME_EXPORT_VERSION = 1;

const instant = z.string();

const exportedUserSettings = {
  budgetMonthAnchor: z.string(),
  budgetMonthHolidayCountry: z.string().nullable(),
  budgetMonthStartDay: z.number(),
  createdAt: instant,
  email: z.string(),
  reportingCurrency: z.string().nullable(),
  taxCountries: z.array(z.string()),
};

const exportedUserSchema = z.object({
  ...exportedUserSettings,
  firstName: z.string(),
  lastName: z.string().nullable(),
});

const singleNameUserSchema = z
  .object({ ...exportedUserSettings, name: z.string() })
  .transform(({ name, ...user }) => ({ ...user, ...splitFullName(name) }));

const exportedBalanceSchema = z.object({
  balanceAt: instant.nullable(),
  balanceMinor: z.number(),
  currency: z.string(),
});

const exportedHoldingSchema = z.object({
  code: z.string().nullable(),
  codeType: z.string().nullable(),
  currency: z.string(),
  label: z.string(),
  providerHoldingId: z.string(),
  quantity: z.string(),
  unitCost: z.string().nullable(),
  unitValue: z.string().nullable(),
  unrealisedGainMinor: z.number().nullable(),
  valuationMinor: z.number(),
  valuedAt: instant.nullable(),
});

const creditorIdentificationsSchema = z.array(
  z.object({ identification: z.string(), schemeName: z.string() })
);

const exportedTransactionSchema = z.object({
  amount: z.number(),
  balanceAfterTransaction: z.number().nullable(),
  bankTransactionCode: z.string().nullable(),
  bankTransactionFamilyCode: z.string().nullable(),
  bankTransactionSubCode: z.string().nullable(),
  category: z.string().nullable(),
  categoryOverride: z.boolean(),
  channel: z.string().nullable(),
  counterpartyName: z.string().nullable(),
  createdAt: instant,
  creditorAccountIban: z.string().nullable(),
  creditorAgentBic: z.string().nullable(),
  creditorCountry: z.string().nullable(),
  creditorIdentifications: creditorIdentificationsSchema.nullable(),
  creditorTown: z.string().nullable(),
  currency: z.string(),
  date: instant,
  debtorAccountIban: z.string().nullable(),
  description: z.string(),
  exchangeFeeMinor: z.number().nullable(),
  exchangeRate: z.string().nullable(),
  id: z.string(),
  intermediaryName: z.string().nullable(),
  isInternalTransfer: z.boolean(),
  merchantCategoryCode: z.string().nullable(),
  merchantKey: z.string().nullable(),
  normalisedDescriptor: z.string().nullable(),
  originalAmount: z.number().nullable(),
  originalCurrency: z.string().nullable(),
  providerTransactionId: z.string().nullable(),
  psuNote: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  referenceNumberScheme: z.string().nullable(),
  remittanceLines: z.array(z.string()),
  resolutionConfidence: z.number().nullable(),
  resolutionStage: z.string().nullable(),
  resolvedCategory: z.string().nullable(),
  status: z.string(),
  transactionDate: instant.nullable(),
  transactionPath: z.string().nullable(),
  valueDate: instant.nullable(),
});

const exportedAccountSchema = z.object({
  balanceAt: instant.nullable(),
  balanceMinor: z.number().nullable(),
  balances: z.array(exportedBalanceSchema),
  createdAt: instant,
  currency: z.string().nullable(),
  holdings: z.array(exportedHoldingSchema),
  iban: z.string().nullable(),
  id: z.string(),
  identificationHash: z.string().nullable(),
  inConsent: z.boolean(),
  name: z.string().nullable(),
  providerAccountId: z.string(),
  transactions: z.array(exportedTransactionSchema),
  type: z.enum(PROVIDER_ACCOUNT_TYPES),
});

const exportedConnectionSchema = z.object({
  accounts: z.array(exportedAccountSchema),
  createdAt: instant,
  id: z.string(),
  institutionBic: z.string().nullable(),
  institutionCountry: z.string().nullable(),
  institutionGroup: z.string().nullable(),
  institutionId: z.string().nullable(),
  institutionName: z.string(),
  lastSyncedAt: instant.nullable(),
  provider: z.string(),
  status: z.string(),
});

const exportedCustomCategorySchema = z.object({
  color: z.string(),
  icon: z.string(),
  id: z.string(),
  label: z.string(),
  parentId: z.string().nullable(),
  parentSlug: z.string().nullable(),
  sortOrder: z.number(),
});

const exportedBudgetLineSchema = z.object({
  amount: z.number(),
  categoryId: z.string().nullable(),
  categorySlug: z.string().nullable(),
  id: z.string(),
  label: z.string().nullable(),
  sortOrder: z.number(),
});

const exportedMerchantOverrideSchema = z.object({
  category: z.string(),
  merchantKey: z.string(),
  merchantName: z.string().nullable(),
});

const exportedDashboardSchema = z.object({
  createdAt: instant,
  id: z.string(),
  title: z.string(),
  updatedAt: instant,
  widgets: z.unknown(),
});

const exportedContent = {
  budgetLines: z.array(exportedBudgetLineSchema),
  connections: z.array(exportedConnectionSchema),
  customCategories: z.array(exportedCustomCategorySchema),
  dashboards: z.array(exportedDashboardSchema),
  exportedAt: instant,
  format: z.literal(DATA_EXPORT_FORMAT),
  merchantOverrides: z.array(exportedMerchantOverrideSchema),
};

export const dataExportSchema = z.union([
  z.object({
    ...exportedContent,
    user: exportedUserSchema,
    version: z.literal(DATA_EXPORT_VERSION),
  }),
  z.object({
    ...exportedContent,
    user: singleNameUserSchema,
    version: z
      .literal(SINGLE_NAME_EXPORT_VERSION)
      .transform(() => DATA_EXPORT_VERSION),
  }),
]);

export type DataExport = z.infer<typeof dataExportSchema>;

export type ExportedConnection = DataExport["connections"][number];

export type ExportedAccount = ExportedConnection["accounts"][number];

export type ExportedTransaction = ExportedAccount["transactions"][number];

export type ExportedHolding = ExportedAccount["holdings"][number];

export const DATA_EXPORT_TRANSACTION_SELECT = {
  amount: true,
  balanceAfterTransaction: true,
  bankTransactionCode: true,
  bankTransactionFamilyCode: true,
  bankTransactionSubCode: true,
  category: true,
  categoryOverride: true,
  channel: true,
  counterpartyName: true,
  createdAt: true,
  creditorAccountIban: true,
  creditorAgentBic: true,
  creditorCountry: true,
  creditorIdentifications: true,
  creditorTown: true,
  currency: true,
  date: true,
  debtorAccountIban: true,
  description: true,
  exchangeFeeMinor: true,
  exchangeRate: true,
  id: true,
  intermediaryName: true,
  isInternalTransfer: true,
  merchantCategoryCode: true,
  merchantKey: true,
  normalisedDescriptor: true,
  originalAmount: true,
  originalCurrency: true,
  providerTransactionId: true,
  psuNote: true,
  referenceNumber: true,
  referenceNumberScheme: true,
  remittanceLines: true,
  resolutionConfidence: true,
  resolutionStage: true,
  resolvedCategory: true,
  status: true,
  transactionDate: true,
  transactionPath: true,
  valueDate: true,
} as const;

export const DATA_EXPORT_HOLDING_SELECT = {
  code: true,
  codeType: true,
  currency: true,
  label: true,
  providerHoldingId: true,
  quantity: true,
  unitCost: true,
  unitValue: true,
  unrealisedGainMinor: true,
  valuationMinor: true,
  valuedAt: true,
} as const;

interface StoredDecimal {
  toString: () => string;
}

export type StoredTransaction = Omit<
  ExportedTransaction,
  | "createdAt"
  | "creditorIdentifications"
  | "date"
  | "transactionDate"
  | "valueDate"
> & {
  createdAt: Date;
  creditorIdentifications: Prisma.JsonValue;
  date: Date;
  transactionDate: Date | null;
  valueDate: Date | null;
};

export type StoredHolding = Omit<
  ExportedHolding,
  "quantity" | "unitCost" | "unitValue" | "valuedAt"
> & {
  quantity: StoredDecimal;
  unitCost: StoredDecimal | null;
  unitValue: StoredDecimal | null;
  valuedAt: Date | null;
};

const isoOrNull = (value: Date | null): string | null =>
  value === null ? null : value.toISOString();

export const exportTransaction = (
  row: StoredTransaction
): ExportedTransaction => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  creditorIdentifications:
    creditorIdentificationsSchema.safeParse(row.creditorIdentifications).data ??
    null,
  date: row.date.toISOString(),
  transactionDate: isoOrNull(row.transactionDate),
  valueDate: isoOrNull(row.valueDate),
});

export const exportHolding = (row: StoredHolding): ExportedHolding => ({
  ...row,
  quantity: row.quantity.toString(),
  unitCost: row.unitCost?.toString() ?? null,
  unitValue: row.unitValue?.toString() ?? null,
  valuedAt: isoOrNull(row.valuedAt),
});
