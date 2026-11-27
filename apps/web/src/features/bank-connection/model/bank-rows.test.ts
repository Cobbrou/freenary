import { describe, expect, test } from "bun:test";

import { accountsOf, buildBankRows, connectedAccountLabel } from "./bank-rows";
import type { BankConnection, BankInstitution } from "./use-bank-connections";

const institution = (
  id: string,
  overrides: Partial<BankInstitution> = {}
): BankInstitution => ({
  bic: `${id.toUpperCase()}XXX`,
  country: "FR",
  id,
  logo: null,
  name: id,
  ...overrides,
});

const account = (
  id: string,
  overrides: Partial<BankConnection["accounts"][number]> = {}
): BankConnection["accounts"][number] => ({
  iban: null,
  id,
  inConsent: true,
  name: null,
  transactionCount: 0,
  type: "CHECKING",
  ...overrides,
});

const connection = (
  id: string,
  overrides: Partial<BankConnection> = {}
): BankConnection => ({
  accounts: [account(`${id}-account`)],
  id,
  institutionCountry: "FR",
  institutionId: id,
  institutionName: id,
  lastSyncedAt: null,
  status: "ACTIVE",
  ...overrides,
});

describe("buildBankRows", () => {
  test("connected banks come first and carry their connection", () => {
    const rows = buildBankRows(
      [institution("alpha"), institution("beta"), institution("gamma")],
      [connection("beta")],
      "en"
    );

    expect(rows.map((row) => row.name)).toEqual(["beta", "alpha", "gamma"]);
    expect(rows[0]?.connection?.id).toBe("beta");
    expect(rows[1]?.connection).toBeNull();
  });

  test("a connected institution is never offered twice", () => {
    const rows = buildBankRows(
      [institution("alpha")],
      [connection("alpha")],
      "en"
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.connection?.id).toBe("alpha");
  });

  test("a connection the provider no longer lists keeps a row", () => {
    const rows = buildBankRows(
      [institution("alpha")],
      [connection("delisted", { institutionName: "Delisted Bank" })],
      "en"
    );

    expect(rows.map((row) => row.name)).toEqual(["Delisted Bank", "alpha"]);
    expect(rows[0]?.institution).toBeNull();
  });

  test("a connection without an institution id keeps a row", () => {
    const rows = buildBankRows(
      [institution("alpha")],
      [
        connection("legacy", {
          institutionId: null,
          institutionName: "Legacy",
        }),
      ],
      "en"
    );

    expect(rows.map((row) => row.name)).toEqual(["Legacy", "alpha"]);
  });

  test("the description is the BIC until the bank is connected", () => {
    const rows = buildBankRows(
      [institution("alpha"), institution("beta")],
      [
        connection("beta", {
          accounts: [account("one"), account("two")],
        }),
      ],
      "en"
    );

    expect(rows[0]?.description).toBe("2 accounts · Not synced yet");
    expect(rows[1]?.description).toBe("ALPHAXXX");
  });

  test("the description counts the accounts the bank no longer shares apart", () => {
    const rows = buildBankRows(
      [institution("alpha")],
      [
        connection("alpha", {
          accounts: [
            account("one"),
            account("two"),
            account("three", { inConsent: false }),
          ],
        }),
      ],
      "en"
    );

    expect(rows[0]?.description).toBe(
      "2 accounts · 1 not shared · Not synced yet"
    );
  });

  test("the description says so when the bank shares none of the accounts", () => {
    const rows = buildBankRows(
      [institution("alpha")],
      [
        connection("alpha", {
          accounts: [
            account("one", { inConsent: false }),
            account("two", { inConsent: false }),
          ],
        }),
      ],
      "en"
    );

    expect(rows[0]?.description).toBe(
      "No account shared · 2 not shared · Not synced yet"
    );
  });

  test("a bank lists its shared accounts before the ones it no longer shares", () => {
    const accounts = accountsOf(
      connection("alpha", {
        accounts: [
          account("one", { inConsent: false }),
          account("two"),
          account("three", { inConsent: false }),
          account("four"),
        ],
      })
    );

    expect(accounts.map((item) => item.id)).toEqual([
      "two",
      "four",
      "one",
      "three",
    ]);
  });

  test("an account reads as its name and the end of its IBAN", () => {
    expect(
      connectedAccountLabel(
        account("joint", {
          iban: "FR76 3000 1007 9412 3456 7890 098",
          name: "Joint account",
        })
      )
    ).toBe("Joint account ·· 0098");

    expect(connectedAccountLabel(account("livret", { type: "LIVRET_A" }))).toBe(
      "Livret A"
    );
  });

  test("a connection that stopped importing says so", () => {
    const rows = buildBankRows(
      [institution("alpha")],
      [connection("alpha", { status: "EXPIRED" })],
      "en"
    );

    expect(rows[0]?.description).toBe(
      "1 account · Reconnect to resume importing"
    );
  });

  test("the same bank in two countries stays two rows", () => {
    const rows = buildBankRows(
      [institution("n26"), institution("n26", { country: "DE" })],
      [],
      "en"
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.institution?.country)).toEqual(["FR", "DE"]);

    const idsReactWillKeyOn = new Set(rows.map((row) => row.id));

    expect(idsReactWillKeyOn.size).toBe(2);
  });

  test("connecting a bank in one country leaves the other on offer", () => {
    const rows = buildBankRows(
      [institution("n26"), institution("n26", { country: "DE" })],
      [connection("n26")],
      "en"
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.connection?.id).toBe("n26");
    expect(rows[1]?.institution?.country).toBe("DE");
  });

  test("a list spanning countries names the one each bank links", () => {
    const rows = buildBankRows(
      [institution("alpha"), institution("beta", { bic: null, country: "DE" })],
      [],
      "en"
    );

    expect(rows[0]?.description).toBe("France · ALPHAXXX");
    expect(rows[1]?.description).toBe("Germany");
  });
});
