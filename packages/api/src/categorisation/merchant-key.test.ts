import { describe, expect, it } from "bun:test";

import { deriveMerchantKey } from "./merchant-key";
import type { MerchantKeyInput } from "./types";

const baseInput: MerchantKeyInput = {
  amountMinor: -1500,
  institutionName: "Test Bank",
  remittanceLines: ["CARTE 12/03 CARREFOUR MARKET PARIS"],
};

describe("deriveMerchantKey", () => {
  describe("card path", () => {
    it("derives normalised descriptor as merchant key", () => {
      const derived = deriveMerchantKey(baseInput);

      expect(derived.path).toBe("card");
      expect(derived.merchantKey.length).toBeGreaterThan(0);
      expect(derived.channel).toBeDefined();
    });

    it("drops deferred and immediate debit markers", () => {
      expect(
        deriveMerchantKey({
          ...baseInput,
          remittanceLines: ["CB DEBIT DIFFERE MCDO", "MCDO"],
        }).merchantKey
      ).toBe("mcdo");

      expect(
        deriveMerchantKey({
          ...baseInput,
          remittanceLines: ["CARTE DEBIT IMMEDIAT MONOPRIX PARIS"],
        }).merchantKey
      ).toBe("monoprix");
    });

    it("uses sub-merchant text when intermediary detected", () => {
      const input: MerchantKeyInput = {
        ...baseInput,
        remittanceLines: ["PAYPAL *MERCHANT NAME"],
      };

      const derived = deriveMerchantKey(input);

      expect(derived.path).toBe("card");

      if (derived.intermediaryName) {
        expect(derived.intermediaryName.toLowerCase()).toContain("paypal");
      }
    });

    it("returns empty merchant key on empty remittance", () => {
      const derived = deriveMerchantKey({
        ...baseInput,
        remittanceLines: [],
      });

      expect(derived.merchantKey).toBe("");
    });
  });

  describe("IBAN path", () => {
    it("uses creditor IBAN as merchant key for RDDT", () => {
      const derived = deriveMerchantKey({
        ...baseInput,
        bankTransactionFamilyCode: "RDDT",
        creditorIban: "FR7630006000011234567890189",
        remittanceLines: ["PRLV SEPA EDF"],
      });

      expect(derived.path).toBe("iban");
      expect(derived.merchantKey).toBe("FR7630006000011234567890189");
    });

    it("uses creditor IBAN as merchant key for RCDT", () => {
      const derived = deriveMerchantKey({
        ...baseInput,
        bankTransactionFamilyCode: "RCDT",
        creditorIban: " fr7630006000011234567890189 ",
        remittanceLines: ["VIR SEPA SALARY"],
      });

      expect(derived.path).toBe("iban");
      expect(derived.merchantKey).toBe("FR7630006000011234567890189");
    });

    it("falls back to card path when no creditor IBAN", () => {
      const derived = deriveMerchantKey({
        ...baseInput,
        bankTransactionFamilyCode: "RDDT",
        creditorIban: undefined,
      });

      expect(derived.path).toBe("card");
    });

    it("falls back to card path for unknown family code", () => {
      const derived = deriveMerchantKey({
        ...baseInput,
        bankTransactionFamilyCode: "UNKNOWN",
        creditorIban: "FR7630006000011234567890189",
      });

      expect(derived.path).toBe("card");
    });
  });

  describe("error handling", () => {
    it("never throws, returns fallback", () => {
      // SAFETY: deliberately passing empty object to test error resilience
      const derived = deriveMerchantKey({} as MerchantKeyInput);

      expect(derived.merchantKey).toBe("");
      expect(derived.path).toBe("card");
    });
  });
});
