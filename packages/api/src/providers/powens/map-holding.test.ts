import { describe, expect, test } from "bun:test";

import { mapPowensInvestment } from "./map-holding";

describe("mapPowensInvestment", () => {
  test("keeps a fractional quantity exact", () => {
    expect(
      mapPowensInvestment({ id: 1, quantity: 3.094, valuation: 100 }, "EUR", 2)
        ?.quantity
    ).toBe("3.094");
  });

  test("converts valuation and unrealised gain to minor units", () => {
    const holding = mapPowensInvestment(
      {
        code: "FR0000120271",
        code_type: "ISIN",
        diff: -12.5,
        id: 7,
        label: "TOTALENERGIES",
        quantity: 12,
        unitprice: 48.2,
        unitvalue: 47.15,
        valuation: 1_055_575.41,
        vdate: "2026-03-04",
      },
      "EUR",
      2
    );

    expect(holding).toEqual({
      code: "FR0000120271",
      codeType: "ISIN",
      currency: "EUR",
      label: "TOTALENERGIES",
      providerHoldingId: "7",
      quantity: "12",
      unitCost: "48.2",
      unitValue: "47.15",
      unrealisedGainMinor: -1250,
      valuationMinor: 105_557_541,
      valuedAt: "2026-03-04",
    });
  });

  test("ignores a code type it cannot vouch for", () => {
    expect(
      mapPowensInvestment(
        { code_type: "XX", id: 1, quantity: 1, valuation: 10 },
        "EUR",
        2
      )?.codeType
    ).toBeUndefined();
  });

  test("drops a line with nothing to value", () => {
    expect(
      mapPowensInvestment(
        { deleted: "2026-03-05 10:00:00", id: 1, quantity: 1, valuation: 10 },
        "EUR",
        2
      )
    ).toBeNull();

    expect(
      mapPowensInvestment({ id: 1, quantity: 1, valuation: null }, "EUR", 2)
    ).toBeNull();
  });
});
