import { describe, expect, it } from "bun:test";

import type {
  DataExport,
  ExportedAccount,
  ExportedTransaction,
} from "../../../lib/data-export";
import { fixtureFromExport } from "./anonymise";
import { isValidIban, pseudonymiserWith } from "./pseudonyms";
import { fixtureSchema } from "./schema";

const OWN_IBAN = "FR7630006000011234567890189";
const FRIEND_IBAN = "FR1420041010050500013M02606";

const transactionOf = (
  overrides: Partial<ExportedTransaction>
): ExportedTransaction => ({
  amount: -1250,
  balanceAfterTransaction: null,
  bankTransactionCode: null,
  bankTransactionFamilyCode: null,
  bankTransactionSubCode: null,
  category: null,
  categoryOverride: false,
  channel: "card",
  counterpartyName: null,
  createdAt: "2026-03-02T08:00:00.000Z",
  creditorAccountIban: null,
  creditorAgentBic: null,
  creditorCountry: null,
  creditorIdentifications: null,
  creditorTown: null,
  currency: "EUR",
  date: "2026-03-01T00:00:00.000Z",
  debtorAccountIban: null,
  description: "",
  exchangeFeeMinor: null,
  exchangeRate: null,
  id: "row-1",
  intermediaryName: null,
  isInternalTransfer: false,
  merchantCategoryCode: "5462",
  merchantKey: null,
  normalisedDescriptor: null,
  originalAmount: null,
  originalCurrency: null,
  providerTransactionId: "provider-1",
  psuNote: null,
  referenceNumber: null,
  referenceNumberScheme: null,
  remittanceLines: ["CB BOULANGERIE PAUL 01/03"],
  resolutionConfidence: null,
  resolutionStage: null,
  resolvedCategory: null,
  status: "BOOK",
  transactionDate: "2026-03-01T00:00:00.000Z",
  transactionPath: null,
  valueDate: "2026-03-02T00:00:00.000Z",
  ...overrides,
});

const accountOf = (
  transactions: ExportedTransaction[],
  overrides: Partial<ExportedAccount> = {}
): ExportedAccount => ({
  balanceAt: "2026-03-05T10:00:00.000Z",
  balanceMinor: 152_300,
  balances: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  currency: "EUR",
  holdings: [],
  iban: OWN_IBAN,
  id: "account-1",
  identificationHash: "hash",
  inConsent: true,
  name: "Compte de chèques M Jean Dupont",
  providerAccountId: "provider-account-1",
  transactions,
  type: "CHECKING",
  ...overrides,
});

const exportOf = (accounts: ExportedAccount[]): DataExport => ({
  budgetLines: [],
  connections: [
    {
      accounts,
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "connection-1",
      institutionBic: "BNPAFRPP",
      institutionCountry: "FR",
      institutionGroup: "BNP Paribas",
      institutionId: "BNP_PARIBAS_FR",
      institutionName: "BNP Paribas",
      lastSyncedAt: null,
      provider: "enable-banking",
      status: "ACTIVE",
    },
  ],
  customCategories: [],
  dashboards: [],
  exportedAt: "2026-03-05T10:00:00.000Z",
  format: "freenary-export",
  merchantOverrides: [],
  user: {
    budgetMonthAnchor: "LAST_WORKING_DAY",
    budgetMonthHolidayCountry: null,
    budgetMonthStartDay: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "jean.dupont@example.org",
    name: "Jean Dupont",
    reportingCurrency: null,
    taxCountries: ["FR"],
  },
  version: 1,
});

const salary = transactionOf({
  amount: 250_000,
  channel: "transfer",
  counterpartyName: "ACME SAS",
  merchantCategoryCode: null,
  providerTransactionId: "provider-salary",
  remittanceLines: ["VIR SEPA ACME SAS SALAIRE MARS M JEAN DUPONT"],
});

const toFriend = transactionOf({
  amount: -4000,
  channel: "transfer",
  counterpartyName: "MARIE LEFEBVRE",
  creditorAccountIban: FRIEND_IBAN,
  merchantCategoryCode: null,
  providerTransactionId: "provider-friend",
  psuNote: "Dinner with Marie",
  referenceNumber: "REF123456",
  remittanceLines: [
    "VIR A MME MARIE LEFEBVRE RESTO",
    `IBAN ${FRIEND_IBAN} marie.lefebvre@mail.fr 06 12 34 56 78`,
  ],
});

const fromSavings = transactionOf({
  amount: 30_000,
  channel: "transfer",
  debtorAccountIban: OWN_IBAN,
  merchantCategoryCode: null,
  providerTransactionId: "provider-internal",
  remittanceLines: ["VIR INTERNE"],
});

const bakery = transactionOf({});

const anonymised = (key: string, keptWords: string[] = []) =>
  fixtureFromExport(
    exportOf([accountOf([salary, toFriend, fromSavings, bakery])]),
    {
      extraNames: [],
      keptWords,
      pseudonymiser: pseudonymiserWith(key),
      shiftDates: true,
    }
  );

const onlyAccountOf = (key: string, keptWords: string[] = []) => {
  const [connection] = anonymised(key, keptWords).fixture.connections;
  const [account] = connection?.accounts ?? [];

  if (!account) {
    throw new Error("the fixture lost the account");
  }

  return account;
};

const transactionAt = (key: string, position: number) => {
  const transaction = onlyAccountOf(key).transactions[position];

  if (!transaction) {
    throw new Error(`the fixture lost transaction ${position}`);
  }

  return transaction;
};

describe("fixtureFromExport", () => {
  it("writes a fixture the mock bank reads back", () => {
    const { fixture } = anonymised("key");

    expect(fixtureSchema.parse(fixture)).toEqual(fixture);
    expect(fixture.shiftDates).toBe(true);
    expect(fixture.connections[0]?.institution).toEqual({
      bic: "BNPAFRPP",
      country: "FR",
      group: "BNP Paribas",
      name: "BNP Paribas",
    });
  });

  it("keeps the content of a transaction that names nobody", () => {
    expect(transactionAt("key", 3)).toEqual({
      amountMinor: -1250,
      balanceAfterMinor: undefined,
      bankTransactionDescription: undefined,
      bankTransactionFamilyCode: undefined,
      bankTransactionSubCode: undefined,
      bookingDate: "2026-03-01",
      creditorAgentBic: undefined,
      creditorCountry: undefined,
      creditorIban: undefined,
      creditorIdentifications: undefined,
      creditorTown: undefined,
      currency: "EUR",
      debtorIban: undefined,
      exchangeRate: undefined,
      merchantCategoryCode: "5462",
      originalAmountMinor: undefined,
      originalCurrency: undefined,
      providerTransactionId: transactionAt("key", 3).providerTransactionId,
      referenceNumber: undefined,
      referenceNumberScheme: undefined,
      remittanceLines: ["CB BOULANGERIE PAUL 01/03"],
      status: "BOOK",
      transactionDate: "2026-03-01",
      valueDate: "2026-03-02",
    });
  });

  it("replaces the holder's name in every text, in the same case", () => {
    const account = onlyAccountOf("key");
    const salaryLine = account.transactions[0]?.remittanceLines[0] ?? "";

    expect(account.name).not.toContain("Jean");
    expect(account.name).not.toContain("Dupont");
    expect(account.name).toStartWith("Compte de chèques M ");
    expect(salaryLine).toStartWith("VIR SEPA ACME SAS SALAIRE MARS M ");
    expect(salaryLine).not.toContain("JEAN");
    expect(salaryLine).not.toContain("DUPONT");
    expect(salaryLine.toLowerCase()).toEndWith(
      (account.name ?? "").slice("Compte de chèques M ".length).toLowerCase()
    );
  });

  it("keeps a company's name on a transfer", () => {
    expect(transactionAt("key", 0).debtorName).toBe("ACME SAS");
  });

  it("replaces a person paid by transfer, wherever the name appears", () => {
    const transfer = transactionAt("key", 1);
    const [first, last] = (transfer.creditorName ?? "").split(" ");

    expect(transfer.creditorName).not.toBe("MARIE LEFEBVRE");
    expect(transfer.remittanceLines[0]).toBe(
      `VIR A MME ${first} ${last} RESTO`
    );
  });

  it("gives the same account the same pseudonymous IBAN everywhere", () => {
    const account = onlyAccountOf("key");
    const internal = transactionAt("key", 2);

    expect(account.iban).not.toBe(OWN_IBAN);
    expect(isValidIban(account.iban ?? "")).toBe(true);
    expect(internal.debtorIban).toBe(account.iban);
  });

  it("scrubs IBANs, emails and phone numbers written in the text", () => {
    const transfer = transactionAt("key", 1);
    const line = transfer.remittanceLines[1] ?? "";

    expect(transfer.creditorIban).not.toBe(FRIEND_IBAN);
    expect(isValidIban(transfer.creditorIban ?? "")).toBe(true);
    expect(line).toStartWith(`IBAN ${transfer.creditorIban} email-`);
    expect(line).toMatch(/@example\.com 0\d \d{2} \d{2} \d{2} \d{2}$/u);
    expect(line).not.toContain("12 34 56 78");
    expect(line).not.toContain("lefebvre");
  });

  it("drops the holder's own notes and replaces identifiers", () => {
    const transfer = transactionAt("key", 1);

    expect(Object.keys(transfer)).not.toContain("psuNote");
    expect(transfer.referenceNumber).toMatch(/^[A-Z]{3}\d{6}$/u);
    expect(transfer.referenceNumber).not.toBe("REF123456");
    expect(transfer.providerTransactionId).not.toContain("provider");
  });

  it("splits the counterparty into creditor and debtor by direction", () => {
    expect(transactionAt("key", 0).creditorName).toBeUndefined();
    expect(transactionAt("key", 1).debtorName).toBeUndefined();
  });

  it("gives the same pseudonyms for the same secret, and others for another", () => {
    expect(anonymised("key").fixture).toEqual(anonymised("key").fixture);
    expect(onlyAccountOf("other").iban).not.toBe(onlyAccountOf("key").iban);
  });

  it("never replaces a kept word", () => {
    const account = onlyAccountOf("key", ["Dupont"]);

    expect(account.name).toEndWith(" Dupont");
  });

  it("reports a replaced name that a card payment also uses", () => {
    const { report } = fixtureFromExport(
      exportOf([accountOf([salary, bakery])]),
      {
        extraNames: ["Paul Martin"],
        keptWords: [],
        pseudonymiser: pseudonymiserWith("key"),
        shiftDates: true,
      }
    );

    expect(report.cardMerchantNames).toEqual(["PAUL"]);
  });

  it("reports the names it replaced and the first names it left", () => {
    const { report } = anonymised("key");

    expect(report.names.map(({ original }) => original)).toEqual([
      "DUPONT",
      "JEAN",
      "LEFEBVRE",
      "MARIE",
    ]);

    expect(report.suspects).toContain("PAUL");
    expect(report).toMatchObject({
      accounts: 1,
      connections: 1,
      transactions: 4,
    });
  });
});
