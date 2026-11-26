import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { Data, Effect, Option } from "effect";

import type {
  ProviderAccount,
  ProviderHolding,
  ProviderInstitution,
  ProviderTransaction,
} from "../../types";
import { fixtureSchema } from "./schema";
import type {
  Fixture,
  FixtureAccount,
  FixtureConnection,
  FixtureTransaction,
} from "./schema";

export const FIXTURES_DIR = path.resolve(
  import.meta.dirname,
  "../../../../fixtures"
);

export const FIXTURE_FILE_EXTENSION = ".json";

const FIXTURE_INSTITUTION =
  /^fixture-(?<name>[a-z0-9]+(?:-[a-z0-9]+)*)-(?<position>\d+)$/u;

const NOT_A_NAME_CHARACTER = /[^a-z0-9]+/gu;
const EDGE_DASHES = /^-+|-+$/gu;
const MONTHS_PER_YEAR = 12;
const ISO_DAY_LENGTH = 10;

interface CachedFixture {
  readonly fixture: Option.Option<Fixture>;
  readonly modifiedAt: number;
}

const parsedFixtures = new Map<string, CachedFixture>();

const parseFixture = Option.liftThrowable((text: string): Fixture =>
  fixtureSchema.parse(JSON.parse(text))
);

export class MockFixtureMissing extends Data.TaggedError("MockFixtureMissing")<{
  readonly institutionId: string;
}> {
  override get message() {
    return `The mock bank has no fixture for ${this.institutionId}`;
  }
}

export const fixtureNameOf = (fileName: string): string =>
  path
    .basename(fileName, FIXTURE_FILE_EXTENSION)
    .toLowerCase()
    .replaceAll(NOT_A_NAME_CHARACTER, "-")
    .replaceAll(EDGE_DASHES, "");

export const fixtureInstitutionId = (name: string, position: number): string =>
  `fixture-${name}-${position}`;

const parseFixtureFile = (file: string): Option.Option<Fixture> => {
  const parsed = parseFixture(readFileSync(file, "utf-8"));

  if (Option.isNone(parsed)) {
    console.warn(`Mock bank: ${file} is not a Freenary fixture, skipped`);
  }

  return parsed;
};

const readFixture = (file: string): Option.Option<Fixture> => {
  const modifiedAt = statSync(file).mtimeMs;
  const cached = parsedFixtures.get(file);

  if (cached?.modifiedAt === modifiedAt) {
    return cached.fixture;
  }

  const fixture = parseFixtureFile(file);

  parsedFixtures.set(file, { fixture, modifiedAt });

  return fixture;
};

interface NamedFixture {
  readonly fixture: Fixture;
  readonly name: string;
}

const fixturesIn = (dir: string): NamedFixture[] =>
  existsSync(dir)
    ? readdirSync(dir)
        .flatMap((file) => {
          const name = fixtureNameOf(file);

          return file.endsWith(FIXTURE_FILE_EXTENSION) && name.length > 0
            ? Option.match(readFixture(path.join(dir, file)), {
                onNone: () => [],
                onSome: (fixture) => [{ fixture, name }],
              })
            : [];
        })
        .toSorted((left, right) => left.name.localeCompare(right.name))
    : [];

export const fixtureInstitutions = (
  dir: string = FIXTURES_DIR
): ProviderInstitution[] =>
  fixturesIn(dir).flatMap(({ fixture, name }) =>
    fixture.connections.map((connection, position) => ({
      bic: connection.institution.bic,
      country: connection.institution.country,
      group: connection.institution.group,
      id: fixtureInstitutionId(name, position),
      name: connection.institution.name,
    }))
  );

const monthIndexOf = (isoDay: string): number =>
  Number(isoDay.slice(0, 4)) * MONTHS_PER_YEAR + Number(isoDay.slice(5, 7)) - 1;

const twoDigits = (count: number): string => String(count).padStart(2, "0");

export const shiftByMonths = (iso: string, months: number): string => {
  if (months === 0) {
    return iso;
  }

  const index = monthIndexOf(iso) + months;
  const year = Math.floor(index / MONTHS_PER_YEAR);
  const month = index - year * MONTHS_PER_YEAR;
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(Number(iso.slice(8, ISO_DAY_LENGTH)), lastDayOfMonth);

  return `${year}-${twoDigits(month + 1)}-${twoDigits(day)}${iso.slice(ISO_DAY_LENGTH)}`;
};

export const monthsToShift = (lastDay: string, today: string): number => {
  const months = monthIndexOf(today) - monthIndexOf(lastDay);

  return shiftByMonths(lastDay, months).slice(0, ISO_DAY_LENGTH) > today
    ? months - 1
    : months;
};

const lastBookingDayOf = (fixture: Fixture): string | undefined =>
  fixture.connections
    .flatMap((connection) =>
      connection.accounts.flatMap((account) =>
        account.transactions.map((transaction) => transaction.bookingDate)
      )
    )
    .toSorted()
    .at(-1);

const shiftOptional = (
  iso: string | undefined,
  months: number
): string | undefined =>
  iso === undefined ? undefined : shiftByMonths(iso, months);

const shiftTransaction = (
  transaction: FixtureTransaction,
  months: number
): FixtureTransaction => ({
  ...transaction,
  bookingDate: shiftByMonths(transaction.bookingDate, months),
  transactionDate: shiftOptional(transaction.transactionDate, months),
  valueDate: shiftOptional(transaction.valueDate, months),
});

const shiftAccount = (
  account: FixtureAccount,
  months: number
): FixtureAccount => ({
  ...account,
  balanceAt: shiftOptional(account.balanceAt, months),
  balances: account.balances.map((balance) => ({
    ...balance,
    balanceAt: shiftOptional(balance.balanceAt, months),
  })),
  holdings: account.holdings.map((holding) => ({
    ...holding,
    valuedAt: shiftOptional(holding.valuedAt, months),
  })),
  transactions: account.transactions.map((transaction) =>
    shiftTransaction(transaction, months)
  ),
});

export const shiftedConnection = (
  fixture: Fixture,
  position: number,
  today: string
): Option.Option<FixtureConnection> => {
  const lastDay = lastBookingDayOf(fixture);
  const months =
    fixture.shiftDates && lastDay !== undefined
      ? monthsToShift(lastDay, today)
      : 0;

  return Option.map(
    Option.fromNullishOr(fixture.connections[position]),
    (connection) => ({
      ...connection,
      accounts: connection.accounts.map((account) =>
        shiftAccount(account, months)
      ),
    })
  );
};

export const fixtureConnection = (
  institutionId: string,
  today: Date,
  dir: string = FIXTURES_DIR
): Option.Option<FixtureConnection> => {
  const groups = FIXTURE_INSTITUTION.exec(institutionId)?.groups;

  if (!(groups?.name && groups.position)) {
    return Option.none();
  }

  const { name } = groups;
  const position = Number(groups.position);
  const found = fixturesIn(dir).find((named) => named.name === name);

  return found
    ? shiftedConnection(
        found.fixture,
        position,
        today.toISOString().slice(0, ISO_DAY_LENGTH)
      )
    : Option.none();
};

export const requireFixture = (institutionId: string, today: Date) =>
  Option.match(fixtureConnection(institutionId, today), {
    onNone: () => Effect.fail(new MockFixtureMissing({ institutionId })),
    onSome: Effect.succeed,
  });

export const fixtureAccounts = (
  connection: FixtureConnection,
  sessionId: string,
  accountSeparator: string
): ProviderAccount[] =>
  connection.accounts.map((account) => ({
    balanceAt: account.balanceAt,
    balanceMinor: account.balanceMinor,
    balances: account.balances.length > 0 ? account.balances : undefined,
    currency: account.currency,
    iban: account.iban,
    name: account.name,
    providerAccountId: `${sessionId}${accountSeparator}${account.key}`,
    type: account.type,
  }));

const accountOf = (
  connection: FixtureConnection,
  accountKey: string
): FixtureAccount | undefined =>
  connection.accounts.find((account) => account.key === accountKey);

export const fixtureTransactions = (
  connection: FixtureConnection,
  accountKey: string,
  dateTo: string
): ProviderTransaction[] =>
  (accountOf(connection, accountKey)?.transactions ?? []).filter(
    (transaction) => transaction.bookingDate <= dateTo
  );

export const fixtureHoldings = (
  connection: FixtureConnection,
  accountKey: string
): ProviderHolding[] => accountOf(connection, accountKey)?.holdings ?? [];
