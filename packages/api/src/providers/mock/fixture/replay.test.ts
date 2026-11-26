import { beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { Option } from "effect";

import {
  fixtureSessionCode,
  fixtureInstitutionOf,
  sessionAccountOf,
} from "../session";
import {
  fixtureAccounts,
  fixtureConnection,
  fixtureInstitutions,
  fixtureNameOf,
  fixtureTransactions,
  monthsToShift,
  shiftByMonths,
} from "./replay";
import type { Fixture, FixtureConnection, FixtureTransaction } from "./schema";

const transactionOn = (bookingDate: string): FixtureTransaction => ({
  amountMinor: -500,
  bookingDate,
  currency: "EUR",
  providerTransactionId: `t-${bookingDate}`,
  remittanceLines: ["CB MONOPRIX"],
  status: "BOOK",
  valueDate: bookingDate,
});

const CONNECTION: FixtureConnection = {
  accounts: [
    {
      balanceAt: "2025-11-30T09:00:00.000Z",
      balanceMinor: 120_000,
      balances: [],
      currency: "EUR",
      holdings: [],
      iban: "FR7630006000011234567890189",
      key: "a1",
      name: "Compte de chèques",
      transactions: [
        transactionOn("2025-10-31"),
        transactionOn("2025-11-15"),
        transactionOn("2025-11-28"),
      ],
      type: "CHECKING",
    },
  ],
  institution: { country: "FR", name: "BNP Paribas" },
};

const fixtureWith = (shiftDates: boolean): Fixture => ({
  connections: [CONNECTION],
  format: "freenary-fixture",
  shiftDates,
  version: 1,
});

let fixturesDir = "";

beforeAll(() => {
  fixturesDir = mkdtempSync(path.join(tmpdir(), "freenary-fixtures-"));

  writeFileSync(
    path.join(fixturesDir, "My Export.json"),
    JSON.stringify(fixtureWith(true))
  );

  writeFileSync(
    path.join(fixturesDir, "kept-dates.json"),
    JSON.stringify(fixtureWith(false))
  );

  writeFileSync(path.join(fixturesDir, "broken.json"), "{ not json");
});

const bookingDaysOf = (institutionId: string, today: string) =>
  Option.match(fixtureConnection(institutionId, new Date(today), fixturesDir), {
    onNone: () => [],
    onSome: (connection) =>
      fixtureTransactions(connection, "a1", "9999-12-31").map(
        (transaction) => transaction.bookingDate
      ),
  });

describe("shiftByMonths", () => {
  it("moves a day by whole months and keeps the time", () => {
    expect(shiftByMonths("2025-11-15T09:30:00.000Z", 6)).toBe(
      "2026-05-15T09:30:00.000Z"
    );
  });

  it("stops on the last day of a shorter month", () => {
    expect(shiftByMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftByMonths("2025-12-31", -1)).toBe("2025-11-30");
  });
});

describe("monthsToShift", () => {
  it("brings the last day into the current month when it is already past", () => {
    expect(monthsToShift("2025-11-05", "2026-05-10")).toBe(6);
  });

  it("stops a month short rather than land after today", () => {
    expect(monthsToShift("2025-11-28", "2026-05-10")).toBe(5);
  });
});

describe("fixtureInstitutions", () => {
  it("lists each connection of each fixture file and skips the rest", () => {
    expect(fixtureInstitutions(fixturesDir)).toEqual([
      {
        bic: undefined,
        country: "FR",
        group: undefined,
        id: "fixture-kept-dates-0",
        name: "BNP Paribas",
      },
      {
        bic: undefined,
        country: "FR",
        group: undefined,
        id: "fixture-my-export-0",
        name: "BNP Paribas",
      },
    ]);
  });
});

describe("fixtureConnection", () => {
  it("moves the history so its last month ends by today", () => {
    expect(
      bookingDaysOf("fixture-my-export-0", "2026-05-10T12:00:00Z")
    ).toEqual(["2026-03-31", "2026-04-15", "2026-04-28"]);
  });

  it("keeps the dates of a fixture made with --keep-dates", () => {
    expect(
      bookingDaysOf("fixture-kept-dates-0", "2026-05-10T12:00:00Z")
    ).toEqual(["2025-10-31", "2025-11-15", "2025-11-28"]);
  });

  it("finds nothing for an unknown fixture or connection", () => {
    expect(bookingDaysOf("fixture-missing-0", "2026-05-10T12:00:00Z")).toEqual(
      []
    );

    expect(
      bookingDaysOf("fixture-my-export-3", "2026-05-10T12:00:00Z")
    ).toEqual([]);
  });
});

describe("fixtureTransactions", () => {
  it("serves the whole history up to the end of the window", () => {
    expect(
      fixtureTransactions(CONNECTION, "a1", "2025-11-20").map(
        (transaction) => transaction.bookingDate
      )
    ).toEqual(["2025-10-31", "2025-11-15"]);
  });
});

describe("fixture sessions", () => {
  it("names the fixture connection the session replays", () => {
    const code = fixtureSessionCode("fixture-my-export-0");

    expect(fixtureInstitutionOf(code)).toEqual(
      Option.some("fixture-my-export-0")
    );

    expect(fixtureInstitutionOf("mock_2026-01-01_forged")).toEqual(
      Option.none()
    );
  });

  it("gives each account an id under its session", () => {
    const code = fixtureSessionCode("fixture-my-export-0");
    const [account] = fixtureAccounts(CONNECTION, code, ":");

    expect(sessionAccountOf(account?.providerAccountId ?? "")).toEqual({
      accountKey: "a1",
      sessionId: code,
    });
  });

  it("turns a file name into the fixture's name", () => {
    expect(fixtureNameOf("/tmp/Freenary Export 2026-05-01.json")).toBe(
      "freenary-export-2026-05-01"
    );
  });
});
