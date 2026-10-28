import { describe, expect, test } from "bun:test";

import type { ProviderTransaction } from "../providers/types";
import { staleTransactionsWhere, syncWindow } from "./bank-sync";

const now = new Date("2026-10-29T12:00:00Z");

const transaction = (
  providerTransactionId: string,
  status: string
): ProviderTransaction => ({
  amountMinor: -1250,
  bookingDate: "2026-10-21",
  currency: "EUR",
  providerTransactionId,
  remittanceLines: ["CARREFOUR"],
  status,
});

describe("syncWindow", () => {
  test("starts at the last sync", () => {
    expect(
      syncWindow(new Date("2026-10-25T08:00:00Z"), now, false, null).dateFrom
    ).toBe("2026-10-25");
  });

  test("reaches back to the oldest pending row", () => {
    expect(
      syncWindow(
        new Date("2026-10-25T08:00:00Z"),
        now,
        false,
        new Date("2026-10-20T00:00:00Z")
      ).dateFrom
    ).toBe("2026-10-20");
  });

  test("never reaches past the 90 days the provider serves", () => {
    expect(
      syncWindow(null, now, false, new Date("2026-01-01T00:00:00Z")).dateFrom
    ).toBe("2026-07-31");
  });
});

describe("staleTransactionsWhere", () => {
  test("drops every rejected row, and pending rows the bank stopped returning", () => {
    expect(
      staleTransactionsWhere("account", "2026-10-20", [
        transaction("booked", "BOOK"),
        transaction("still-pending", "PDNG"),
      ])
    ).toEqual({
      OR: [
        { status: "RJCT" },
        {
          date: { gte: new Date("2026-10-20") },
          providerTransactionId: { notIn: ["booked", "still-pending"] },
          status: "PDNG",
        },
      ],
      accountId: "account",
    });
  });
});
