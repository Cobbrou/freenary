import { describe, expect, test } from "bun:test";

import { mapEBCompletedConnection } from "./map-connection";

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
});
