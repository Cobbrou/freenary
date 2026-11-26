import { en, fr } from "@faker-js/faker";

import type {
  DataExport,
  ExportedAccount,
  ExportedConnection,
  ExportedHolding,
  ExportedTransaction,
} from "../../../lib/data-export";
import type { ProviderCreditorIdentification } from "../../types";
import { isValidIban, pseudoIban } from "./pseudonyms";
import type { Pseudonymiser } from "./pseudonyms";
import { FIXTURE_FORMAT, FIXTURE_VERSION } from "./schema";
import type {
  Fixture,
  FixtureAccount,
  FixtureConnection,
  FixtureHolding,
  FixtureTransaction,
} from "./schema";

export interface AnonymiseOptions {
  readonly extraNames: readonly string[];
  readonly keptWords: readonly string[];
  readonly pseudonymiser: Pseudonymiser;
  readonly shiftDates: boolean;
}

export interface NameReplacement {
  readonly original: string;
  readonly replacement: string;
}

export interface AnonymiseReport {
  readonly accounts: number;
  readonly cardMerchantNames: readonly string[];
  readonly connections: number;
  readonly names: readonly NameReplacement[];
  readonly suspects: readonly string[];
  readonly transactions: number;
}

const DIACRITICS = /\p{Diacritic}/gu;
const NAME_SPLIT = /[^\p{L}\p{M}]+/u;
const WORD = /[\p{L}\p{M}]+/gu;

const IBAN_IN_TEXT =
  /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/gu;

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu;

const FRENCH_PHONE =
  /(?<prefix>\+33[\s.]?|\b0)(?<rest>[1-9](?:[\s.-]?\d{2}){4})\b/gu;

const SINGLE_WORD = /^[A-Z]+$/u;
const MIN_NAME_TOKEN_LENGTH = 2;
const EMAIL_HASH_LENGTH = 8;
const ID_HASH_LENGTH = 20;
const DEFAULT_COUNTRY = "FR";

const PERSON_TO_PERSON_CHANNELS: ReadonlySet<string | null> = new Set([
  null,
  "transfer",
  "unknown",
]);

const NAME_PARTICLES: ReadonlySet<string> = new Set([
  "DA",
  "DE",
  "DES",
  "DI",
  "DR",
  "DU",
  "EP",
  "EPOUSE",
  "ET",
  "LA",
  "LE",
  "M",
  "MADAME",
  "MADEMOISELLE",
  "MISS",
  "MLLE",
  "MM",
  "MME",
  "MONSIEUR",
  "MR",
  "MRS",
  "MS",
  "OU",
  "VAN",
  "VON",
]);

const PERSONAL_IDENTIFICATION_SCHEMES: ReadonlySet<string> = new Set([
  "BBAN",
  "CPAN",
  "IBAN",
  "MSISDN",
]);

const isIsinOrAmf = (codeType: string): codeType is "AMF" | "ISIN" =>
  codeType === "AMF" || codeType === "ISIN";

const normaliseWord = (word: string): string =>
  word.normalize("NFD").replaceAll(DIACRITICS, "").toUpperCase();

const nameTokensOf = (name: string): string[] =>
  name.split(NAME_SPLIT).flatMap((word) => {
    const token = normaliseWord(word);

    return token.length >= MIN_NAME_TOKEN_LENGTH && !NAME_PARTICLES.has(token)
      ? [token]
      : [];
  });

const singleWordNames = (lists: readonly (readonly string[] | undefined)[]) => [
  ...new Set(
    lists
      .flatMap((list) => list ?? [])
      .flatMap((name) => {
        const word = normaliseWord(name);

        return SINGLE_WORD.test(word) ? [word] : [];
      })
  ),
];

const FIRST_NAMES = singleWordNames([
  fr.person?.first_name?.generic,
  fr.person?.first_name?.female,
  fr.person?.first_name?.male,
  en.person?.first_name?.generic,
  en.person?.first_name?.female,
  en.person?.first_name?.male,
]);

const LAST_NAMES = singleWordNames([
  fr.person?.last_name?.generic,
  en.person?.last_name?.generic,
]);

const KNOWN_FIRST_NAMES: ReadonlySet<string> = new Set(FIRST_NAMES);

const looksLikePerson = (name: string): boolean =>
  nameTokensOf(name).some((token) => KNOWN_FIRST_NAMES.has(token));

const isTransferLike = (transaction: ExportedTransaction): boolean =>
  !transaction.merchantCategoryCode &&
  PERSON_TO_PERSON_CHANNELS.has(transaction.channel);

const allTransactions = (exported: DataExport): ExportedTransaction[] =>
  exported.connections.flatMap((connection) =>
    connection.accounts.flatMap((account) => account.transactions)
  );

const personNamesOf = (
  exported: DataExport,
  extraNames: readonly string[]
): string[] => [
  exported.user.name,
  ...extraNames,
  ...allTransactions(exported).flatMap((transaction) =>
    transaction.counterpartyName &&
    isTransferLike(transaction) &&
    looksLikePerson(transaction.counterpartyName)
      ? [transaction.counterpartyName]
      : []
  ),
];

const pickReplacement = (
  pseudonymiser: Pseudonymiser,
  token: string,
  taken: ReadonlySet<string>
): string => {
  const pool = KNOWN_FIRST_NAMES.has(token) ? FIRST_NAMES : LAST_NAMES;
  const start = pseudonymiser.index("name", token, pool.length);
  const candidates = [...pool.slice(start), ...pool.slice(0, start)];

  return (
    candidates.find((candidate) => !taken.has(candidate)) ??
    pseudonymiser.reshape("name", token)
  );
};

const nameMapOf = (
  pseudonymiser: Pseudonymiser,
  names: readonly string[],
  keptWords: readonly string[]
): ReadonlyMap<string, string> => {
  const kept = new Set(keptWords.map(normaliseWord));
  const tokens = [
    ...new Set(
      names
        .flatMap(nameTokensOf)
        .flatMap((token) => (kept.has(token) ? [] : [token]))
    ),
  ].toSorted();

  const taken = new Set(tokens);

  return new Map(
    tokens.map((token) => {
      const replacement = pickReplacement(pseudonymiser, token, taken);

      taken.add(replacement);

      return [token, replacement] as const;
    })
  );
};

const inCaseOf = (original: string, replacement: string): string => {
  if (original === original.toUpperCase()) {
    return replacement;
  }

  if (original === original.toLowerCase()) {
    return replacement.toLowerCase();
  }

  return `${replacement.charAt(0)}${replacement.slice(1).toLowerCase()}`;
};

interface Scrubber {
  readonly iban: (iban: string) => string;
  readonly text: (text: string) => string;
}

const scrubberWith = (
  pseudonymiser: Pseudonymiser,
  names: ReadonlyMap<string, string>
): Scrubber => {
  const iban = (original: string) => pseudoIban(pseudonymiser, original);

  const text = (original: string): string =>
    original
      .replaceAll(IBAN_IN_TEXT, (candidate) =>
        isValidIban(candidate) ? iban(candidate) : candidate
      )
      .replaceAll(
        EMAIL,
        (email) =>
          `email-${pseudonymiser.hex("email", email.toLowerCase(), EMAIL_HASH_LENGTH)}@example.com`
      )
      .replaceAll(
        FRENCH_PHONE,
        (_phone: string, prefix: string, rest: string) =>
          `${prefix}${pseudonymiser.reshape("phone", rest)}`
      )
      .replaceAll(WORD, (word) => {
        const replacement = names.get(normaliseWord(word));

        return replacement ? inCaseOf(word, replacement) : word;
      });

  return { iban, text };
};

const defined = <T>(entry: T | null): T | undefined => entry ?? undefined;

const dayOf = (instant: string | null): string | undefined =>
  instant === null ? undefined : instant.slice(0, 10);

const identificationsOf = (
  stored: ExportedTransaction["creditorIdentifications"],
  pseudonymiser: Pseudonymiser
): ProviderCreditorIdentification[] | undefined =>
  stored && stored.length > 0
    ? stored.map(({ identification, schemeName }) => ({
        identification: PERSONAL_IDENTIFICATION_SCHEMES.has(
          schemeName.toUpperCase()
        )
          ? pseudonymiser.reshape("identification", identification)
          : identification,
        schemeName,
      }))
    : undefined;

const remittanceOf = (
  transaction: ExportedTransaction,
  scrubber: Scrubber
): string[] => {
  if (transaction.remittanceLines.length > 0) {
    return transaction.remittanceLines.map(scrubber.text);
  }

  return transaction.description.length > 0
    ? [scrubber.text(transaction.description)]
    : [];
};

const counterpartyOf = (
  transaction: ExportedTransaction,
  scrubber: Scrubber
): Pick<FixtureTransaction, "creditorName" | "debtorName"> => {
  if (!transaction.counterpartyName) {
    return {};
  }

  const name = scrubber.text(transaction.counterpartyName);

  return transaction.amount < 0 ? { creditorName: name } : { debtorName: name };
};

const fixtureTransactionOf = (
  transaction: ExportedTransaction,
  pseudonymiser: Pseudonymiser,
  scrubber: Scrubber
): FixtureTransaction => ({
  amountMinor: transaction.amount,
  balanceAfterMinor: defined(transaction.balanceAfterTransaction),
  bankTransactionDescription: defined(transaction.bankTransactionCode),
  bankTransactionFamilyCode: defined(transaction.bankTransactionFamilyCode),
  bankTransactionSubCode: defined(transaction.bankTransactionSubCode),
  bookingDate: transaction.date.slice(0, 10),
  ...counterpartyOf(transaction, scrubber),
  creditorAgentBic: defined(transaction.creditorAgentBic),
  creditorCountry: defined(transaction.creditorCountry),
  creditorIban: transaction.creditorAccountIban
    ? scrubber.iban(transaction.creditorAccountIban)
    : undefined,
  creditorIdentifications: identificationsOf(
    transaction.creditorIdentifications,
    pseudonymiser
  ),
  creditorTown: defined(transaction.creditorTown),
  currency: transaction.currency,
  debtorIban: transaction.debtorAccountIban
    ? scrubber.iban(transaction.debtorAccountIban)
    : undefined,
  exchangeRate: defined(transaction.exchangeRate),
  merchantCategoryCode: defined(transaction.merchantCategoryCode),
  originalAmountMinor: defined(transaction.originalAmount),
  originalCurrency: defined(transaction.originalCurrency),
  providerTransactionId: `t${pseudonymiser.hex(
    "transaction",
    transaction.providerTransactionId ?? transaction.id,
    ID_HASH_LENGTH
  )}`,
  referenceNumber: transaction.referenceNumber
    ? pseudonymiser.reshape("reference", transaction.referenceNumber)
    : undefined,
  referenceNumberScheme: defined(transaction.referenceNumberScheme),
  remittanceLines: remittanceOf(transaction, scrubber),
  status: transaction.status,
  transactionDate: dayOf(transaction.transactionDate),
  valueDate: dayOf(transaction.valueDate),
});

const fixtureHoldingOf = (
  holding: ExportedHolding,
  pseudonymiser: Pseudonymiser
): FixtureHolding => ({
  code: defined(holding.code),
  codeType:
    holding.codeType && isIsinOrAmf(holding.codeType)
      ? holding.codeType
      : undefined,
  currency: holding.currency,
  label: holding.label,
  providerHoldingId: `h${pseudonymiser.hex(
    "holding",
    holding.providerHoldingId,
    ID_HASH_LENGTH
  )}`,
  quantity: holding.quantity,
  unitCost: defined(holding.unitCost),
  unitValue: defined(holding.unitValue),
  unrealisedGainMinor: defined(holding.unrealisedGainMinor),
  valuationMinor: holding.valuationMinor,
  valuedAt: defined(holding.valuedAt),
});

const fixtureAccountOf = (
  account: ExportedAccount,
  position: number,
  pseudonymiser: Pseudonymiser,
  scrubber: Scrubber
): FixtureAccount => ({
  balanceAt: defined(account.balanceAt),
  balanceMinor: defined(account.balanceMinor),
  balances: account.balances.map((balance) => ({
    balanceAt: defined(balance.balanceAt),
    balanceMinor: balance.balanceMinor,
    currency: balance.currency,
  })),
  currency: defined(account.currency),
  holdings: account.holdings.map((holding) =>
    fixtureHoldingOf(holding, pseudonymiser)
  ),
  iban: account.iban ? scrubber.iban(account.iban) : undefined,
  key: `a${position + 1}`,
  name: account.name ? scrubber.text(account.name) : undefined,
  transactions: account.transactions.map((transaction) =>
    fixtureTransactionOf(transaction, pseudonymiser, scrubber)
  ),
  type: account.type,
});

const fixtureConnectionOf = (
  connection: ExportedConnection,
  pseudonymiser: Pseudonymiser,
  scrubber: Scrubber
): FixtureConnection => ({
  accounts: connection.accounts.map((account, position) =>
    fixtureAccountOf(account, position, pseudonymiser, scrubber)
  ),
  institution: {
    bic: defined(connection.institutionBic),
    country: connection.institutionCountry ?? DEFAULT_COUNTRY,
    group: defined(connection.institutionGroup),
    name: connection.institutionName,
  },
});

const suspectsIn = (
  fixture: Fixture,
  names: ReadonlyMap<string, string>,
  keptWords: readonly string[]
): string[] => {
  const replacements = new Set([
    ...names.values(),
    ...keptWords.map(normaliseWord),
  ]);

  const words = fixture.connections.flatMap((connection) =>
    connection.accounts.flatMap((account) =>
      account.transactions.flatMap((transaction) =>
        [
          ...transaction.remittanceLines,
          transaction.creditorName ?? "",
          transaction.debtorName ?? "",
        ].flatMap((line) => line.match(WORD) ?? [])
      )
    )
  );

  return [
    ...new Set(
      words.flatMap((word) => {
        const normalised = normaliseWord(word);

        return KNOWN_FIRST_NAMES.has(normalised) &&
          !replacements.has(normalised)
          ? [normalised]
          : [];
      })
    ),
  ].toSorted();
};

const cardMerchantNamesIn = (
  exported: DataExport,
  names: ReadonlyMap<string, string>
): string[] => {
  const cardWords = new Set(
    allTransactions(exported)
      .flatMap((transaction) =>
        isTransferLike(transaction) ? [] : transaction.remittanceLines
      )
      .flatMap((line) => line.match(WORD) ?? [])
      .map(normaliseWord)
  );

  return [...names.keys()].filter((token) => cardWords.has(token));
};

export const fixtureFromExport = (
  exported: DataExport,
  { extraNames, keptWords, pseudonymiser, shiftDates }: AnonymiseOptions
): { fixture: Fixture; report: AnonymiseReport } => {
  const names = nameMapOf(
    pseudonymiser,
    personNamesOf(exported, extraNames),
    keptWords
  );

  const scrubber = scrubberWith(pseudonymiser, names);

  const fixture: Fixture = {
    connections: exported.connections.map((connection) =>
      fixtureConnectionOf(connection, pseudonymiser, scrubber)
    ),
    format: FIXTURE_FORMAT,
    shiftDates,
    version: FIXTURE_VERSION,
  };

  return {
    fixture,
    report: {
      accounts: fixture.connections.reduce(
        (total, connection) => total + connection.accounts.length,
        0
      ),
      cardMerchantNames: cardMerchantNamesIn(exported, names),
      connections: fixture.connections.length,
      names: [...names].map(([original, replacement]) => ({
        original,
        replacement,
      })),
      suspects: suspectsIn(fixture, names, keptWords),
      transactions: allTransactions(exported).length,
    },
  };
};
