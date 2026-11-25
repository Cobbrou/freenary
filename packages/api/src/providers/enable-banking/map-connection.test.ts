import { describe, expect, test } from "bun:test";

import {
  mapEBAccount,
  mapEBCompletedConnection,
  pickBalancePerCurrency,
} from "./map-connection";

describe("mapEBCompletedConnection", () => {
  test("maps the account IBAN from account_id", () => {
    const connection = mapEBCompletedConnection({
      accounts: [
        {
          account_id: { iban: "FR761234" },
          name: "Current account",
          uid: "account-1",
        },
      ],
      aspsp: { name: "Provider Bank" },
      session_id: "session-1",
    });

    expect(connection).toEqual({
      accounts: [
        {
          iban: "FR761234",
          name: "Current account",
          providerAccountId: "account-1",
          type: "UNKNOWN",
        },
      ],
      institutionName: "Provider Bank",
      providerSessionId: "session-1",
    });
  });

  test("reads the kind of account from its ISO 20022 cash account type", () => {
    const connection = mapEBCompletedConnection({
      accounts: [
        { cash_account_type: "CACC", uid: "current" },
        { cash_account_type: "CARD", uid: "card" },
        { cash_account_type: "LOAN", uid: "loan" },
        { cash_account_type: "SVGS", uid: "savings" },
        { cash_account_type: "OTHR", uid: "other" },
      ],
      session_id: "session-1",
    });

    expect(connection.accounts.map((account) => account.type)).toEqual([
      "CHECKING",
      "CARD",
      "LOAN",
      "SAVINGS",
      "UNKNOWN",
    ]);
  });

  test("recognises a French savings product from its name", () => {
    const connection = mapEBCompletedConnection({
      accounts: [
        { cash_account_type: "SVGS", product: "LIVRET A", uid: "livret" },
        {
          cash_account_type: "SVGS",
          name: "Livret Développement Durable et Solidaire",
          uid: "ldds",
        },
        { cash_account_type: "OTHR", name: "PEA-PME", uid: "pea" },
        { cash_account_type: "CACC", name: "Compte PEL", uid: "current" },
      ],
      session_id: "session-1",
    });

    expect(connection.accounts.map((account) => account.type)).toEqual([
      "LIVRET_A",
      "LDDS",
      "PEA",
      "CHECKING",
    ]);
  });

  test("keeps the account currency, but not the multi-currency marker", () => {
    const connection = mapEBCompletedConnection({
      accounts: [
        { currency: "SEK", uid: "single" },
        { currency: "XXX", uid: "multi" },
        { uid: "unknown" },
      ],
      session_id: "session-1",
    });

    expect(connection.accounts.map((account) => account.currency)).toEqual([
      "SEK",
      undefined,
      undefined,
    ]);
  });
});

const balance = (balanceType: string, amount: string, currency = "EUR") => ({
  balance_amount: { amount, currency },
  balance_type: balanceType,
});

describe("pickBalancePerCurrency", () => {
  test("prefers the booked balance over the available ones", () => {
    expect(
      pickBalancePerCurrency([
        balance("CLAV", "150.00"),
        balance("ITAV", "140.00"),
        balance("CLBD", "100.00"),
      ])
    ).toEqual([
      { balanceAt: undefined, balanceMinor: 10_000, currency: "EUR" },
    ]);
  });

  test("falls back to an unranked balance type", () => {
    expect(pickBalancePerCurrency([balance("INFO", "-12.50")])).toEqual([
      { balanceAt: undefined, balanceMinor: -1250, currency: "EUR" },
    ]);
  });

  test("keeps one balance per currency, each with its own digits", () => {
    expect(
      pickBalancePerCurrency([
        {
          ...balance("ITBD", "20.00", "USD"),
          last_change_date_time: "2026-10-28T10:00:00Z",
        },
        { ...balance("OPBD", "5.00"), reference_date: "2026-10-27" },
        balance("ITAV", "1500", "JPY"),
        balance("XPCD", "6.00"),
      ])
    ).toEqual([
      {
        balanceAt: "2026-10-28T10:00:00Z",
        balanceMinor: 2000,
        currency: "USD",
      },
      { balanceAt: undefined, balanceMinor: 600, currency: "EUR" },
      { balanceAt: undefined, balanceMinor: 1500, currency: "JPY" },
    ]);
  });
});

describe("mapEBAccount", () => {
  const details = {
    account_id: { iban: "FR761234" },
    cash_account_type: "CACC",
    currency: "EUR",
    name: "Jane Doe",
  };

  test("reads the main balance in the account currency", () => {
    expect(
      mapEBAccount("uid-1", details, [
        balance("CLBD", "20.00", "USD"),
        balance("CLBD", "100.00"),
      ])
    ).toEqual({
      balanceAt: undefined,
      balanceMinor: 10_000,
      balances: [
        { balanceAt: undefined, balanceMinor: 2000, currency: "USD" },
        { balanceAt: undefined, balanceMinor: 10_000, currency: "EUR" },
      ],
      currency: "EUR",
      iban: "FR761234",
      name: "Jane Doe",
      providerAccountId: "uid-1",
      type: "CHECKING",
    });
  });

  test("takes the first balance's currency for a multi-currency account", () => {
    const account = mapEBAccount("uid-1", { ...details, currency: "XXX" }, [
      balance("CLBD", "20.00", "USD"),
      balance("CLBD", "100.00"),
    ]);

    expect(account.currency).toBe("USD");
    expect(account.balanceMinor).toBe(2000);
  });

  test("returns the account without balances when they could not be read", () => {
    expect(mapEBAccount("uid-1", details, null)).toEqual({
      currency: "EUR",
      iban: "FR761234",
      name: "Jane Doe",
      providerAccountId: "uid-1",
      type: "CHECKING",
    });
  });
});
