import { z } from "zod";

import { PROVIDER_ACCOUNT_TYPES } from "../../types";

export const FIXTURE_FORMAT = "freenary-fixture";
export const FIXTURE_VERSION = 1;

const optionalText = z.string().optional();

const fixtureTransactionSchema = z.object({
  amountMinor: z.number(),
  balanceAfterMinor: z.number().optional(),
  bankTransactionDescription: optionalText,
  bankTransactionFamilyCode: optionalText,
  bankTransactionSubCode: optionalText,
  bookingDate: z.string(),
  creditorAgentBic: optionalText,
  creditorCountry: optionalText,
  creditorIban: optionalText,
  creditorIdentifications: z
    .array(z.object({ identification: z.string(), schemeName: z.string() }))
    .optional(),
  creditorName: optionalText,
  creditorTown: optionalText,
  currency: z.string(),
  debtorIban: optionalText,
  debtorName: optionalText,
  exchangeRate: optionalText,
  merchantCategoryCode: optionalText,
  originalAmountMinor: z.number().optional(),
  originalCurrency: optionalText,
  providerTransactionId: z.string(),
  referenceNumber: optionalText,
  referenceNumberScheme: optionalText,
  remittanceLines: z.array(z.string()),
  status: z.string(),
  transactionDate: optionalText,
  valueDate: optionalText,
});

const fixtureHoldingSchema = z.object({
  code: optionalText,
  codeType: z.enum(["ISIN", "AMF"]).optional(),
  currency: z.string(),
  label: z.string(),
  providerHoldingId: z.string(),
  quantity: z.string(),
  unitCost: optionalText,
  unitValue: optionalText,
  unrealisedGainMinor: z.number().optional(),
  valuationMinor: z.number(),
  valuedAt: optionalText,
});

const fixtureBalanceSchema = z.object({
  balanceAt: optionalText,
  balanceMinor: z.number(),
  currency: z.string(),
});

const fixtureAccountSchema = z.object({
  balanceAt: optionalText,
  balanceMinor: z.number().optional(),
  balances: z.array(fixtureBalanceSchema),
  currency: optionalText,
  holdings: z.array(fixtureHoldingSchema),
  iban: optionalText,
  key: z.string().regex(/^[a-z0-9]+$/u),
  name: optionalText,
  transactions: z.array(fixtureTransactionSchema),
  type: z.enum(PROVIDER_ACCOUNT_TYPES),
});

const fixtureConnectionSchema = z.object({
  accounts: z.array(fixtureAccountSchema),
  institution: z.object({
    bic: optionalText,
    country: z.string(),
    group: optionalText,
    name: z.string(),
  }),
});

export const fixtureSchema = z.object({
  connections: z.array(fixtureConnectionSchema),
  format: z.literal(FIXTURE_FORMAT),
  shiftDates: z.boolean(),
  version: z.literal(FIXTURE_VERSION),
});

export type Fixture = z.infer<typeof fixtureSchema>;

export type FixtureConnection = Fixture["connections"][number];

export type FixtureAccount = FixtureConnection["accounts"][number];

export type FixtureTransaction = FixtureAccount["transactions"][number];

export type FixtureHolding = FixtureAccount["holdings"][number];
