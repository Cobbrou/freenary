import { describe, expect, it } from "bun:test";

import {
  accountTypeRule,
  CASH_FLOW_ACCOUNT_TYPES,
  cashFlowAccountTypesSql,
  INTERNAL_TRANSFER_ACCOUNT_TYPES,
  refineAccountTypeByName,
  signedBalanceOf,
} from "./account-types";

describe("account type rules", () => {
  it("counts spending and income only on everyday accounts", () => {
    expect(CASH_FLOW_ACCOUNT_TYPES).toEqual(["CHECKING", "CARD", "UNKNOWN"]);
  });

  it("never pairs a loan repayment as a transfer between own accounts", () => {
    expect(INTERNAL_TRANSFER_ACCOUNT_TYPES).not.toContain("LOAN");
    expect(INTERNAL_TRANSFER_ACCOUNT_TYPES).toContain("LIVRET_A");
    expect(INTERNAL_TRANSFER_ACCOUNT_TYPES).toContain("PEA");
  });

  it("files a deposit by the wrapper it lands in", () => {
    expect(accountTypeRule("LIVRET_A").savingCategory).toBe("savings");
    expect(accountTypeRule("LIFE_INSURANCE").savingCategory).toBe("savings");
    expect(accountTypeRule("PEA").savingCategory).toBe("securities");
    expect(accountTypeRule("RETIREMENT").savingCategory).toBe("retirement");
    expect(accountTypeRule("CHECKING").savingCategory).toBeNull();
  });

  it("reads a type it does not know as UNKNOWN", () => {
    expect(accountTypeRule("SOMETHING_NEW")).toEqual(
      accountTypeRule("UNKNOWN")
    );
  });

  it("filters raw SQL on the same types", () => {
    expect(cashFlowAccountTypesSql('ba."type"')).toBe(
      `ba."type"::text IN ('CHECKING', 'CARD', 'UNKNOWN')`
    );
  });
});

describe("signedBalanceOf", () => {
  it("makes a debt negative whatever sign the bank reports", () => {
    expect(signedBalanceOf("LOAN", 900_000)).toBe(-900_000);
    expect(signedBalanceOf("LOAN", -900_000)).toBe(-900_000);
    expect(signedBalanceOf("CARD", -20_000)).toBe(-20_000);
  });

  it("keeps the sign of an account that holds money", () => {
    expect(signedBalanceOf("CHECKING", -5000)).toBe(-5000);
    expect(signedBalanceOf("LIVRET_A", 5000)).toBe(5000);
  });
});

describe("refineAccountTypeByName", () => {
  it("recognises the French regulated savings accounts", () => {
    expect(refineAccountTypeByName("SAVINGS", ["LIVRET A"])).toBe("LIVRET_A");
    expect(refineAccountTypeByName("SAVINGS", ["Livret Bleu"])).toBe(
      "LIVRET_A"
    );

    expect(refineAccountTypeByName("SAVINGS", ["LDD"])).toBe("LDDS");
    expect(
      refineAccountTypeByName("SAVINGS", [
        "Livret de développement durable et solidaire",
      ])
    ).toBe("LDDS");

    expect(refineAccountTypeByName("SAVINGS", ["Mon LEP"])).toBe("LEP");
    expect(refineAccountTypeByName("SAVINGS", ["Plan Épargne Logement"])).toBe(
      "PEL"
    );

    expect(refineAccountTypeByName("SAVINGS", ["CEL"])).toBe("CEL");
    expect(refineAccountTypeByName("UNKNOWN", ["PEA PME"])).toBe("PEA");
    expect(refineAccountTypeByName("SAVINGS", ["Compte à terme 12 mois"])).toBe(
      "TERM_DEPOSIT"
    );
  });

  it("does not mistake a word that starts the same", () => {
    expect(refineAccountTypeByName("SAVINGS", ["Livret Agir"])).toBe("SAVINGS");
    expect(refineAccountTypeByName("SAVINGS", ["Livret Jeune"])).toBe(
      "SAVINGS"
    );
  });

  it("leaves a type the provider already made precise", () => {
    expect(refineAccountTypeByName("CHECKING", ["Compte PEL"])).toBe(
      "CHECKING"
    );

    expect(refineAccountTypeByName("LOAN", ["Prêt PEL"])).toBe("LOAN");
  });

  it("tries each name in turn", () => {
    expect(refineAccountTypeByName("SAVINGS", [undefined, "LEP"])).toBe("LEP");
  });
});
