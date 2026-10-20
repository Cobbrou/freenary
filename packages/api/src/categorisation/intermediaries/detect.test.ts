import { beforeAll, describe, expect, it } from "bun:test";

import { BY_CREDITOR_IBAN, INTERMEDIARY_CATALOGUE } from "./catalogue";
import { detectIntermediary } from "./detect";

describe("detectIntermediary", () => {
  it("detects sumup and recovers sub-merchant", () => {
    const intermediary = detectIntermediary({
      normalisedDescriptor: "sumup boulangerie dupont",
      rawDescriptor: "CB SUMUP *BOULANGERIE DUPONT",
    });

    expect(intermediary).not.toBeNull();

    if (!intermediary) {
      throw new Error("unreachable");
    }

    expect(intermediary.intermediaryId).toBe("sumup");
    expect(intermediary.intermediaryName).toBe("SumUp");
    expect(intermediary.submerchantText).toBe("boulangerie dupont");
    expect(intermediary.normalisedSubmerchant).toBe("boulangerie dupont");
    expect(intermediary.confidence).toBe("high");
    expect(intermediary.matchedBy).toBe("marker");
  });

  it("detects square and recovers sub-merchant", () => {
    const intermediary = detectIntermediary({
      normalisedDescriptor: "sq walmart",
      rawDescriptor: "SQ *WALMART",
    });

    expect(intermediary).not.toBeNull();

    if (!intermediary) {
      throw new Error("unreachable");
    }

    expect(intermediary.intermediaryId).toBe("square");
    expect(intermediary.submerchantText).toBe("walmart");
    expect(intermediary.normalisedSubmerchant).toBe("walmart");
    expect(intermediary.confidence).toBe("high");
  });

  it("detects zettle and recovers sub-merchant", () => {
    const intermediary = detectIntermediary({
      normalisedDescriptor: "ztl nm burger ops",
      rawDescriptor: "ZTL*NM BURGER OPS",
    });

    expect(intermediary).not.toBeNull();

    if (!intermediary) {
      throw new Error("unreachable");
    }

    expect(intermediary.intermediaryId).toBe("zettle");
    expect(intermediary.intermediaryName).toBe("Zettle");
    expect(intermediary.submerchantText).toBe("nm burger ops");
    expect(intermediary.confidence).toBe("high");
  });

  it("detects paypal and recovers sub-merchant", () => {
    const intermediary = detectIntermediary({
      normalisedDescriptor: "paypal vinted",
      rawDescriptor: "PAYPAL*VINTED",
    });

    expect(intermediary).not.toBeNull();

    if (!intermediary) {
      throw new Error("unreachable");
    }

    expect(intermediary.intermediaryId).toBe("paypal");
    expect(intermediary.submerchantText).toBe("vinted");
    expect(intermediary.normalisedSubmerchant).toBe("vinted");
    expect(intermediary.confidence).toBe("high");
    expect(intermediary.matchedBy).toBe("marker");
  });

  it("returns null for amzn mktp fr (not a catalogued intermediary)", () => {
    const intermediary = detectIntermediary({
      normalisedDescriptor: "amzn mktp fr",
      rawDescriptor: "AMZN Mktp FR*308J",
    });

    expect(intermediary).toBeNull();
  });

  it("returns null when marker is not the leading token", () => {
    const intermediary = detectIntermediary({
      normalisedDescriptor: "boulangerie sumup",
      rawDescriptor: "BOULANGERIE SUMUP",
    });

    expect(intermediary).toBeNull();
  });

  it("detects stripe alone with null submerchantText", () => {
    const intermediary = detectIntermediary({
      normalisedDescriptor: "stripe",
      rawDescriptor: "STRIPE",
    });

    expect(intermediary).not.toBeNull();

    if (!intermediary) {
      throw new Error("unreachable");
    }

    expect(intermediary.intermediaryId).toBe("stripe");
    expect(intermediary.submerchantText).toBeNull();
    expect(intermediary.normalisedSubmerchant).toBe("");
    expect(intermediary.matchedBy).toBe("marker");
  });

  it("stripe with trailing text still has null submerchant (carriesSubmerchant false)", () => {
    const intermediary = detectIntermediary({
      normalisedDescriptor: "stripe payments",
      rawDescriptor: "STRIPE PAYMENTS",
    });

    expect(intermediary).not.toBeNull();

    if (!intermediary) {
      throw new Error("unreachable");
    }

    expect(intermediary.intermediaryId).toBe("stripe");
    expect(intermediary.submerchantText).toBeNull();
  });

  const TEST_IBAN = "NL00TEST0000000099";

  beforeAll(() => {
    BY_CREDITOR_IBAN[TEST_IBAN] = {
      definition: INTERMEDIARY_CATALOGUE.adyen,
      id: "adyen",
    };
  });

  it("matches by IBAN when no marker is present", () => {
    const intermediary = detectIntermediary({
      creditorIban: TEST_IBAN,
      normalisedDescriptor: "restaurant dupont",
      rawDescriptor: "RESTAURANT DUPONT",
    });

    expect(intermediary).not.toBeNull();

    if (!intermediary) {
      throw new Error("unreachable");
    }

    expect(intermediary.intermediaryId).toBe("adyen");
    expect(intermediary.intermediaryName).toBe("Adyen");
    expect(intermediary.matchedBy).toBe("iban");
    expect(intermediary.confidence).toBe("high");
    expect(intermediary.submerchantText).toBeNull();
  });

  it("matches by creditor identifier with an empty descriptor", () => {
    const intermediary = detectIntermediary({
      creditorIdentifications: [{ identification: "NL48ZZZ342764500000" }],
      normalisedDescriptor: "",
      rawDescriptor: "",
    });

    expect(intermediary?.intermediaryId).toBe("adyen");
    expect(intermediary?.matchedBy).toBe("creditor-identifier");
    expect(intermediary?.confidence).toBe("high");
  });

  it("matches any creditor identification with an empty descriptor", () => {
    const intermediary = detectIntermediary({
      creditorIdentifications: [
        { identification: "UNKNOWN" },
        { identification: "NL08ZZZ502057730000" },
      ],
      normalisedDescriptor: "",
      rawDescriptor: "",
    });

    expect(intermediary).not.toBeNull();

    if (!intermediary) {
      throw new Error("unreachable");
    }

    expect(intermediary.intermediaryId).toBe("mollie");
    expect(intermediary.intermediaryName).toBe("Mollie");
    expect(intermediary.matchedBy).toBe("creditor-identifier");
    expect(intermediary.confidence).toBe("high");
  });

  it("returns null for empty string without throwing", () => {
    const intermediary = detectIntermediary({
      normalisedDescriptor: "",
      rawDescriptor: "",
    });

    expect(intermediary).toBeNull();
  });

  it("returns null when creditorIban is not in catalogue", () => {
    const intermediary = detectIntermediary({
      creditorIban: "DE89370400440532013000",
      normalisedDescriptor: "unknown merchant",
      rawDescriptor: "UNKNOWN MERCHANT",
    });

    expect(intermediary).toBeNull();
  });

  it("marker match takes priority over IBAN match", () => {
    const intermediary = detectIntermediary({
      creditorIban: TEST_IBAN,
      normalisedDescriptor: "adyen some merchant",
      rawDescriptor: "ADYEN SOME MERCHANT",
    });

    expect(intermediary).not.toBeNull();

    if (!intermediary) {
      throw new Error("unreachable");
    }

    expect(intermediary.matchedBy).toBe("marker");
    expect(intermediary.intermediaryId).toBe("adyen");
  });

  it("promotes medium confidence to high when asterisk is at a scheme position", () => {
    const intermediary = detectIntermediary({
      normalisedDescriptor: "klarna",
      rawDescriptor: "KLARNA *STORE",
    });

    expect(intermediary).not.toBeNull();

    if (!intermediary) {
      throw new Error("unreachable");
    }

    expect(intermediary.intermediaryId).toBe("klarna");
    expect(intermediary.confidence).toBe("high");
  });

  it("keeps medium confidence when no corroborating asterisk", () => {
    const intermediary = detectIntermediary({
      normalisedDescriptor: "klarna",
      rawDescriptor: "KLARNA STORE",
    });

    expect(intermediary).not.toBeNull();

    if (!intermediary) {
      throw new Error("unreachable");
    }

    expect(intermediary.intermediaryId).toBe("klarna");
    expect(intermediary.confidence).toBe("medium");
  });

  it("detects pp as paypal", () => {
    const intermediary = detectIntermediary({
      normalisedDescriptor: "pp merchant name",
      rawDescriptor: "PP*MERCHANT NAME",
    });

    expect(intermediary).not.toBeNull();

    if (!intermediary) {
      throw new Error("unreachable");
    }

    expect(intermediary.intermediaryId).toBe("paypal");
    expect(intermediary.submerchantText).toBe("merchant name");
  });

  it("detects cko as checkout.com", () => {
    const intermediary = detectIntermediary({
      normalisedDescriptor: "cko online store",
      rawDescriptor: "CKO*ONLINE STORE",
    });

    expect(intermediary).not.toBeNull();

    if (!intermediary) {
      throw new Error("unreachable");
    }

    expect(intermediary.intermediaryId).toBe("checkout");
    expect(intermediary.intermediaryName).toBe("Checkout.com");
    expect(intermediary.submerchantText).toBe("online store");
  });

  it("returns null for a descriptor whose leading token names an Object prototype member", () => {
    for (const inherited of [
      "constructor",
      "tostring",
      "valueof",
      "hasownproperty",
      "proto",
    ]) {
      expect(
        detectIntermediary({
          normalisedDescriptor: `${inherited} cafe`,
          rawDescriptor: `${inherited.toUpperCase()} CAFE`,
        })
      ).toBeNull();
    }
  });
});
