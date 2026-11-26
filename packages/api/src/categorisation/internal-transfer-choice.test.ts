import { describe, expect, it } from "bun:test";

import { counterpartyMemoryOf } from "./internal-transfer-choice";

const transfer = {
  amount: -20_000,
  category: null,
  counterpartyName: "AMANDINE LAURENT",
  creditorAccountIban: null,
  debtorAccountIban: null,
  isInternalTransfer: true,
  merchantKey: "amandine laurent compte perso",
  resolvedCategory: "internal-transfer",
};

const payment = {
  ...transfer,
  isInternalTransfer: false,
  resolvedCategory: "people",
};

describe("counterpartyMemoryOf", () => {
  it("remembers the counterparty as the member's when they file the transaction under transfers", () => {
    expect(counterpartyMemoryOf(payment, "internal-transfer")).toBe("mine");
  });

  it("remembers that the counterparty is someone else when a transfer becomes spending or income", () => {
    expect(counterpartyMemoryOf(transfer, "people")).toBe("not-mine");
    expect(counterpartyMemoryOf(transfer, "other-income")).toBe("not-mine");
  });

  it("only forgets what the member declared when a transfer becomes savings", () => {
    expect(counterpartyMemoryOf(transfer, "savings")).toBe("forget");
  });

  it("only forgets what the member declared on any other change", () => {
    expect(counterpartyMemoryOf(payment, "restaurants")).toBe("forget");
  });

  it("leaves the counterparty alone when the category is cleared", () => {
    expect(counterpartyMemoryOf(transfer, null)).toBe("none");
  });
});
