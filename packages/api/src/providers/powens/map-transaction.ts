import type { ProviderTransaction } from "../types";
import type { PowensTransaction } from "./client";
import { isReported, toMinorUnits } from "./client";

interface CounterpartyFields {
  creditorIban?: string;
  creditorName?: string;
  debtorIban?: string;
  debtorName?: string;
}

const IBAN_SCHEME = "iban";
const PENDING = "PDNG";
const BOOKED = "BOOK";

const FAMILY_CODE_BY_TYPE = {
  bank: { issued: "CHRG", received: "CHRG" },
  card: { issued: "CCRD", received: "CCRD" },
  check: { issued: "ICHQ", received: "RCHQ" },
  deferred_card: { issued: "CCRD", received: "CCRD" },
  deposit: { issued: "CNTR", received: "CNTR" },
  fee: { issued: "CHRG", received: "CHRG" },
  loan_repayment: { issued: "LDAS", received: "LDAS" },
  order: { issued: "IDDT", received: "RDDT" },
  payout: { issued: "ICDT", received: "RCDT" },
  summary_card: { issued: "CCRD", received: "CCRD" },
  transfer: { issued: "ICDT", received: "RCDT" },
  withdrawal: { issued: "CNTR", received: "CNTR" },
} satisfies Record<string, { issued: string; received: string }>;

const isCodedType = (type: string): type is keyof typeof FAMILY_CODE_BY_TYPE =>
  Object.hasOwn(FAMILY_CODE_BY_TYPE, type);

const mapCounterparty = (
  transaction: PowensTransaction,
  value: number
): CounterpartyFields => {
  const { counterparty } = transaction;
  const label = counterparty?.label;

  if (!(counterparty && label)) {
    return {};
  }

  const iban =
    counterparty.account_scheme_name === IBAN_SCHEME
      ? (counterparty.account_identification ?? undefined)
      : undefined;

  const roleImpliedBySign = value < 0 ? "creditor" : "debtor";
  const role = counterparty.type ?? roleImpliedBySign;

  return role === "creditor"
    ? { creditorIban: iban, creditorName: label }
    : { debtorIban: iban, debtorName: label };
};

const remittanceLines = (transaction: PowensTransaction): string[] => {
  const lines: string[] = [];

  for (const line of [transaction.original_wording, transaction.wording]) {
    if (line && !lines.includes(line)) {
      lines.push(line);
    }
  }

  return lines;
};

export const mapPowensTransaction = (
  transaction: PowensTransaction,
  currency: string,
  precision: number
): ProviderTransaction | null => {
  const { value, date: bookingDate, type } = transaction;

  if (transaction.deleted || !isReported(value) || !bookingDate) {
    return null;
  }

  const typeName = type ?? "";
  const codes = isCodedType(typeName)
    ? FAMILY_CODE_BY_TYPE[typeName]
    : undefined;

  return {
    ...mapCounterparty(transaction, value),
    amountMinor: toMinorUnits(value, precision),
    bankTransactionDescription: type ?? undefined,
    bankTransactionFamilyCode: value < 0 ? codes?.issued : codes?.received,
    bookingDate,
    currency,
    providerTransactionId: String(transaction.id),
    psuNote: transaction.comment ?? undefined,
    remittanceLines: remittanceLines(transaction),
    status: transaction.coming ? PENDING : BOOKED,
    transactionDate: transaction.rdate ?? undefined,
    valueDate: transaction.vdate ?? undefined,
  };
};

export const mapPowensTransactions = (
  transactions: readonly PowensTransaction[],
  currency: string,
  precision: number
): ProviderTransaction[] => {
  const mapped: ProviderTransaction[] = [];

  for (const transaction of transactions) {
    const providerTransaction = mapPowensTransaction(
      transaction,
      currency,
      precision
    );

    if (providerTransaction) {
      mapped.push(providerTransaction);
    }
  }

  return mapped;
};
