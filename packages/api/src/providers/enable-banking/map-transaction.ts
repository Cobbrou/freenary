import { createHash } from "node:crypto";

import { Array as Arr } from "effect";

import type {
  ProviderCreditorIdentification,
  ProviderTransaction,
} from "../types";
import type { EBCreditorIdentification, EBTransaction } from "./client";

type EBIdentifications =
  EBTransaction["creditor_account_additional_identification"];

const LEADING_MINUS = /^-/u;
const MINOR_UNIT_DIGITS = 2;
const DEBIT_INDICATOR = "DBIT";
const CREDIT_INDICATOR = "CRDT";
const UNIT_SEPARATOR = "\u001F";
const FINGERPRINT_LENGTH = 32;
const FALLBACK_CURRENCY = "EUR";
const BOOKED = "BOOK";

export const parseMinorUnits = (
  amount: string,
  creditDebitIndicator: string = CREDIT_INDICATOR
): number => {
  const unsigned = amount.replace(LEADING_MINUS, "");
  const [units = "0", rawFraction = ""] = unsigned.split(".");
  const fraction = rawFraction
    .padEnd(MINOR_UNIT_DIGITS, "0")
    .slice(0, MINOR_UNIT_DIGITS);

  const magnitude = Math.trunc(Number(`${units}${fraction}`));
  const sign = creditDebitIndicator === DEBIT_INDICATOR ? -1 : 1;

  return magnitude * sign;
};

const identificationsOf = (
  raw: EBIdentifications
): readonly EBCreditorIdentification[] => (raw ? Arr.ensure(raw) : []);

const fingerprintCreditorIdentifications = (raw: EBIdentifications): string[] =>
  identificationsOf(raw)
    .map(
      (identification) =>
        `${identification.scheme_name ?? ""}${UNIT_SEPARATOR}${identification.identification ?? ""}`
    )
    .toSorted();

const deriveFingerprint = (tx: EBTransaction): string => {
  const stableFields = {
    balanceAfterAmount: tx.balance_after_transaction?.amount,
    balanceAfterCurrency: tx.balance_after_transaction?.currency,
    bankTransactionCode: tx.bank_transaction_code?.code,
    bankTransactionDescription: tx.bank_transaction_code?.description,
    bankTransactionSubCode: tx.bank_transaction_code?.sub_code,
    bookingDate: tx.booking_date,
    creditDebitIndicator: tx.credit_debit_indicator,
    creditorAgentBic: tx.creditor_agent?.bic_fi,
    creditorCountry: tx.creditor?.postal_address?.country,
    creditorIban: tx.creditor_account?.iban,
    creditorIdentifications: fingerprintCreditorIdentifications(
      tx.creditor_account_additional_identification
    ),
    creditorName: tx.creditor?.name,
    creditorTown: tx.creditor?.postal_address?.town_name,
    debtorIban: tx.debtor_account?.iban,
    debtorName: tx.debtor?.name,
    exchangeRate: tx.exchange_rate?.exchange_rate,
    merchantCategoryCode: tx.merchant_category_code,
    note: tx.note,
    referenceNumber: tx.reference_number,
    referenceNumberSchema: tx.reference_number_schema,
    remittanceInformation: tx.remittance_information?.toSorted(),
    transactionAmount: tx.transaction_amount?.amount,
    transactionCurrency: tx.transaction_amount?.currency,
    transactionDate: tx.transaction_date,
    valueDate: tx.value_date,
  };

  return createHash("sha256")
    .update(JSON.stringify(stableFields))
    .digest("hex")
    .slice(0, FINGERPRINT_LENGTH);
};

const toProviderIdentifications = (
  raw: EBIdentifications
): ProviderCreditorIdentification[] | undefined => {
  const named: ProviderCreditorIdentification[] = [];

  for (const item of identificationsOf(raw)) {
    const { identification, scheme_name: schemeName } = item;

    if (identification && schemeName) {
      named.push({ identification, schemeName });
    }
  }

  return named.length > 0 ? named : undefined;
};

const mapCreditorFields = (tx: EBTransaction) => ({
  creditorAgentBic: tx.creditor_agent?.bic_fi,
  creditorCountry: tx.creditor?.postal_address?.country,
  creditorIban: tx.creditor_account?.iban,
  creditorIdentifications: toProviderIdentifications(
    tx.creditor_account_additional_identification
  ),
  creditorName: tx.creditor?.name,
  creditorTown: tx.creditor?.postal_address?.town_name,
});

const mapAmountFields = (tx: EBTransaction) => ({
  amountMinor: parseMinorUnits(
    tx.transaction_amount?.amount ?? "0",
    tx.credit_debit_indicator
  ),
  balanceAfterMinor: tx.balance_after_transaction?.amount
    ? parseMinorUnits(tx.balance_after_transaction.amount)
    : undefined,
  currency: tx.transaction_amount?.currency ?? FALLBACK_CURRENCY,
  exchangeRate: tx.exchange_rate?.exchange_rate,
});

const mapEBTransaction = (
  tx: EBTransaction,
  fallbackDate: string,
  providerTransactionId: string
): ProviderTransaction => ({
  ...mapAmountFields(tx),
  ...mapCreditorFields(tx),
  bankTransactionDescription: tx.bank_transaction_code?.description,
  bankTransactionFamilyCode: tx.bank_transaction_code?.code,
  bankTransactionSubCode: tx.bank_transaction_code?.sub_code,
  bookingDate: tx.booking_date ?? fallbackDate,
  debtorIban: tx.debtor_account?.iban,
  debtorName: tx.debtor?.name,
  merchantCategoryCode: tx.merchant_category_code,
  providerTransactionId,
  psuNote: tx.note,
  referenceNumber: tx.reference_number,
  referenceNumberScheme: tx.reference_number_schema,
  remittanceLines: tx.remittance_information ?? [],
  status: tx.status ?? BOOKED,
  transactionDate: tx.transaction_date,
  valueDate: tx.value_date,
});

export const mapEBTransactions = (
  transactions: readonly EBTransaction[],
  fallbackDate: string
): ProviderTransaction[] => {
  const fingerprintOccurrences = new Map<string, number>();

  return transactions.map((tx) => {
    if (tx.entry_reference !== undefined) {
      return mapEBTransaction(tx, fallbackDate, tx.entry_reference);
    }

    const fingerprint = deriveFingerprint(tx);
    const occurrence = (fingerprintOccurrences.get(fingerprint) ?? 0) + 1;

    fingerprintOccurrences.set(fingerprint, occurrence);

    return mapEBTransaction(
      tx,
      fallbackDate,
      `derived:${fingerprint}:${occurrence}`
    );
  });
};
