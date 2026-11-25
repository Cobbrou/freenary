import type { SpendingCategory } from "../lib/taxonomy";
import type { TransactionChannel } from "./normalise/types";

export type Iso3166Alpha2Country = string;

export type Iso4217Currency = string;

export type Iso18245MerchantCategoryCode = string;

export type Iso20022FamilyCode = string;

export type Iso20022SubCode = string;

export type OutgoingNegativeMinorUnits = number;

export type TransactionPath = "iban" | "card";

export type ResolutionStage =
  | "channel"
  | "internal-transfer"
  | "user-override"
  | "dictionary"
  | "mcc"
  | "rules"
  | "cached-model"
  | "model"
  | "none";

export type ResolutionBand = "auto" | "suggest" | "unknown";

export interface ResolutionResult {
  category: SpendingCategory | null;
  merchantName: string | null;
  intermediaryName: string | null;
  confidence: number;
  band: ResolutionBand;
  stage: ResolutionStage;
}

export interface CategoriseInput {
  userId: string;
  merchantKey: string;
  normalisedDescriptor: string;
  rawDescriptor: string;
  channel: TransactionChannel;
  path: TransactionPath;
  country?: Iso3166Alpha2Country | null;
  creditorIban?: string | null;
  bankTransactionCode?: string | null;
  counterpartyName?: string | null;
  merchantCategoryCode?: Iso18245MerchantCategoryCode | null;
  amountMinor: OutgoingNegativeMinorUnits;
  currency: Iso4217Currency;
  referenceAmountMinor?: number | null;
}

export interface MerchantKeyInput {
  remittanceLines: readonly string[];
  creditorName?: string | null;
  debtorName?: string | null;
  creditorIban?: string | null;
  bankTransactionFamilyCode?: Iso20022FamilyCode | null;
  bankTransactionSubCode?: Iso20022SubCode | null;
  amountMinor: OutgoingNegativeMinorUnits;
  institutionName: string;
  institutionBic?: string | null;
  institutionGroup?: string | null;
  country?: Iso3166Alpha2Country | null;
  creditorIdentifications?: readonly { identification: string }[] | null;
}

export interface MerchantKeyResult {
  merchantKey: string;
  path: TransactionPath;
  normalisedDescriptor: string;
  channel: TransactionChannel;
  intermediaryName: string | null;
  payeeText: string | null;
}

export interface DictionaryEntry {
  name: string;
  category: SpendingCategory;
}
