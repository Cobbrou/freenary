import { describe, expect, it } from "bun:test";

import {
  isOwnerNameKey,
  counterpartyKeysOf,
  isDeclaredOwn,
  memberNameOf,
  namesOwnerOf,
  ownCounterpartiesOf,
  ownerNameKeyOf,
} from "./own-counterparty";

const named = (memberName: string | null) =>
  ownCounterpartiesOf({
    memberName,
    overriddenMerchantKeys: [],
    stored: [],
  });

describe("ownerNameKeyOf", () => {
  it("reads the same person whatever the order, title, case and accents", () => {
    expect(ownerNameKeyOf("M. NOUCHET Marius")).toBe("MARIUS NOUCHET");

    expect(ownerNameKeyOf("Marius Nouchet")).toBe("MARIUS NOUCHET");

    expect(ownerNameKeyOf("MME Hélène  DUPONT")).toBe("DUPONT HELENE");
  });

  it("is unknown without a name", () => {
    expect(ownerNameKeyOf(null)).toBeNull();

    expect(ownerNameKeyOf("  ")).toBeNull();

    expect(ownerNameKeyOf("M.")).toBeNull();
  });
});

const own = ownCounterpartiesOf({
  overriddenMerchantKeys: ["marius nouchet loyer"],
  stored: [
    { isOwn: true, key: "MARIUS NOUCHET", kind: "name" },
    { isOwn: true, key: "DUPONT JEAN OU", kind: "name" },
    { isOwn: false, key: "PAUL MARTIN", kind: "name" },
    { isOwn: true, key: "LT601010012345678901", kind: "iban" },
    { isOwn: false, key: "FR7630006000011234567890189", kind: "iban" },
    { isOwn: true, key: "revolut", kind: "merchant" },
  ],
});

describe("namesOwnerOf", () => {
  it("knows the member by the name of their account and the names banks gave them", () => {
    expect(
      namesOwnerOf(
        { channel: "transfer", counterpartyNameKey: "MARIUS NOUCHET" },
        own
      )
    ).toBe(true);

    expect(
      namesOwnerOf(
        { channel: null, counterpartyNameKey: "DUPONT JEAN OU" },
        own
      )
    ).toBe(true);
  });

  it("reads anyone else as someone else", () => {
    expect(
      namesOwnerOf(
        { channel: "transfer", counterpartyNameKey: "DUPONT PIERRE" },
        own
      )
    ).toBe(false);

    expect(
      namesOwnerOf(
        { channel: "transfer", counterpartyNameKey: "PAUL MARTIN" },
        {
          ...own,
          ownerNames: new Set(["PAUL MARTIN"]),
        }
      )
    ).toBe(false);
  });

  it("lets a category the member picked for the merchant win", () => {
    expect(
      namesOwnerOf(
        {
          channel: "transfer",
          counterpartyNameKey: "MARIUS NOUCHET",
          merchantKey: "marius nouchet loyer",
        },
        own
      )
    ).toBe(false);
  });

  it("only reads the name of a transfer", () => {
    expect(
      namesOwnerOf(
        { channel: "card", counterpartyNameKey: "MARIUS NOUCHET" },
        own
      )
    ).toBeNull();

    expect(namesOwnerOf({ channel: "transfer" }, own)).toBeNull();
  });

  it("keeps a name of one word out of the owner names", () => {
    expect(isOwnerNameKey("MARIUS")).toBe(false);

    expect(isOwnerNameKey("MARIUS NOUCHET")).toBe(true);
  });

  it("counts the member's first and last name as theirs", () => {
    const fromProfile = named(
      memberNameOf({ firstName: "Marius", lastName: "Nouchet" })
    );

    expect([...fromProfile.ownerNames]).toEqual(["MARIUS NOUCHET"]);

    expect(
      namesOwnerOf(
        { channel: "transfer", merchantKey: "vers m marius nouchet" },
        fromProfile
      )
    ).toBe(true);

    expect(
      named(memberNameOf({ firstName: "Marius", lastName: null })).ownerNames
        .size
    ).toBe(0);

    expect(named(memberNameOf(null)).ownerNames.size).toBe(0);
  });

  it("reads the owner in a descriptor that only names them", () => {
    const owns = (merchantKey: string) =>
      namesOwnerOf({ channel: "transfer", merchantKey }, own);

    expect(owns("m marius nouchet")).toBe(true);

    expect(owns("vers m marius nouchet")).toBe(true);

    expect(owns("m marius nouchet m marius nouchet m marius nouchet")).toBe(
      true
    );

    expect(owns("dotblocks solutions salaire marius nouchet")).toBeNull();

    expect(owns("marius nouchet loyer")).toBeNull();

    expect(
      namesOwnerOf({ channel: "card", merchantKey: "marius nouchet" }, own)
    ).toBeNull();
  });
});

describe("isDeclaredOwn", () => {
  it("follows what the member said about an IBAN or a merchant", () => {
    expect(
      isDeclaredOwn({ counterpartyIban: "LT601010012345678901" }, own)
    ).toBe(true);

    expect(isDeclaredOwn({ merchantKey: "revolut" }, own)).toBe(true);

    expect(
      isDeclaredOwn(
        {
          counterpartyIban: "FR7630006000011234567890189",
          merchantKey: "revolut",
        },
        own
      )
    ).toBe(false);
  });
});

describe("counterpartyKeysOf", () => {
  it("remembers the IBAN and the name, and the merchant only without them", () => {
    expect(
      counterpartyKeysOf({
        counterpartyIban: "lt60 1010 0123 4567 8901",
        counterpartyName: "M NOUCHET MARIUS",
        merchantKey: "LT601010012345678901",
      })
    ).toEqual([
      { key: "LT601010012345678901", kind: "iban" },
      { key: "MARIUS NOUCHET", kind: "name" },
    ]);

    expect(
      counterpartyKeysOf({
        counterpartyIban: null,
        counterpartyName: null,
        merchantKey: "revolut",
      })
    ).toEqual([{ key: "revolut", kind: "merchant" }]);
  });
});
