import { describe, expect, it } from "bun:test";

import { converterOf } from "../fx/converter";
import { rateBookOf } from "../fx/rate-book";
import type { RecurrenceTransaction, RecurringExpense } from "./recurrence";
import {
  REGULAR_INTERVAL_SPREAD,
  STABLE_AMOUNT_SPREAD,
  VARIABLE_AMOUNT_SPREAD,
  cadenceWindow,
  classifyRecurrence,
  recurringInWindow,
  recurringMonthsInWindow,
  stableAmounts,
  stillRecurring,
  trailingCadence,
  trailingYear,
} from "./recurrence";

describe("RecurringExpense", () => {
  it("defines the expected shape", () => {
    const expense: RecurringExpense = {
      amountSpread: 0,
      category: "bills-utilities",
      confidence: "confirmed",
      currency: "EUR",
      frequency: "monthly",
      intervalDays: 30,
      intervalSpread: 0,
      kind: "fixed",
      lastSeen: new Date(),
      merchantKey: "edf",
      merchantName: "EDF",
      nextExpected: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      occurrences: 12,
      reportingAmountMinor: 8500,
      typicalAmountMinor: 8500,
    };

    expect(expense.frequency).toBe("monthly");
    expect(expense.intervalDays).toBe(30);
    expect(expense.occurrences).toBe(12);
  });

  it("supports all frequency values", () => {
    const frequencies: RecurringExpense["frequency"][] = [
      "weekly",
      "monthly",
      "quarterly",
      "annual",
      "irregular",
    ];

    expect(frequencies).toHaveLength(5);
  });
});

const WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

const monthlySeries = (
  merchantKey: string,
  first: Date,
  occurrences: number
): RecurrenceTransaction[] =>
  Array.from({ length: occurrences }, (_, index) => ({
    amount: -1500,
    category: "bills-utilities",
    counterpartyName: merchantKey,
    currency: "EUR",
    date: new Date(first.getFullYear(), first.getMonth() + index, 5),
    merchantKey,
    resolvedCategory: null,
  }));

describe("recurringInWindow", () => {
  const asOf = new Date(2026, 8, 15);
  const window = { from: new Date(asOf.getTime() - WINDOW_MS), to: asOf };

  it("detects a merchant recurring inside the window", () => {
    const detected = recurringInWindow(
      monthlySeries("netflix", new Date(2025, 9, 5), 6),
      window
    );

    expect(detected).toHaveLength(1);
    expect(detected[0]?.merchantKey).toBe("netflix");
    expect(detected[0]?.frequency).toBe("monthly");
    expect(detected[0]?.occurrences).toBe(6);
  });

  it("excludes a merchant that stopped recurring before the window", () => {
    const detected = recurringInWindow(
      monthlySeries("old-gym", new Date(2024, 1, 5), 12),
      window
    );

    expect(detected).toHaveLength(0);
  });

  it("excludes occurrences after the window's end", () => {
    const detected = recurringInWindow(
      [
        ...monthlySeries("old-gym", new Date(2024, 1, 5), 12),
        ...monthlySeries("netflix", new Date(2025, 9, 5), 6),
        ...monthlySeries("new-gym", new Date(2026, 9, 5), 4),
      ],
      window
    );

    expect(detected.map((e) => e.merchantKey)).toEqual(["netflix"]);
  });
});

describe("cadenceWindow", () => {
  const from = new Date(2026, 5, 1);
  const to = new Date(2026, 5, 30);

  it("reaches a year either side of the period", () => {
    const window = cadenceWindow(from, to);

    expect(window.from.getTime()).toBe(from.getTime() - WINDOW_MS);
    expect(window.to.getTime()).toBe(to.getTime() + WINDOW_MS);
  });

  it("classifies the first month of a history from the months after it", () => {
    const detected = recurringInWindow(
      monthlySeries("landlord", from, 3),
      cadenceWindow(from, to)
    );

    expect(detected.map((e) => e.merchantKey)).toEqual(["landlord"]);
    expect(detected[0]?.frequency).toBe("monthly");
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;

const yearly = (date: Date): RecurrenceTransaction => ({
  amount: -6990,
  category: null,
  counterpartyName: "AMAZON PRIME",
  currency: "EUR",
  date,
  merchantKey: "amazon prime",
  resolvedCategory: null,
});

describe("trailingCadence", () => {
  const asOf = new Date("2026-10-26T12:00:00Z");
  const payments = [
    yearly(new Date("2025-10-20T00:00:00Z")),
    yearly(new Date("2026-10-20T00:00:00Z")),
  ];

  it("detects a yearly payment the trailing year cuts in half", () => {
    expect(recurringInWindow(payments, trailingYear(asOf))).toHaveLength(0);

    const detected = recurringInWindow(payments, trailingCadence(asOf));

    expect(detected.map((e) => e.frequency)).toEqual(["annual"]);
  });

  it("reaches back two of the widest annual gaps", () => {
    const window = trailingCadence(asOf);

    expect(window.to).toBe(asOf);
    expect(window.from.getTime()).toBe(asOf.getTime() - 790 * DAY_MS);
  });

  it("keeps a yearly payment listed until its next renewal is due", () => {
    const beforeRenewal = new Date("2027-10-01T12:00:00Z");

    const detected = recurringInWindow(
      payments,
      trailingCadence(beforeRenewal)
    );

    expect(detected.map((e) => e.frequency)).toEqual(["annual"]);
    expect(detected.map((e) => stillRecurring(e, beforeRenewal))).toEqual([
      true,
    ]);
  });

  it("drops a yearly payment once its renewal is missed", () => {
    const missedRenewal = new Date("2027-11-25T12:00:00Z");

    const detected = recurringInWindow(
      payments,
      trailingCadence(missedRenewal)
    );

    expect(detected.map((e) => stillRecurring(e, missedRenewal))).toEqual([
      false,
    ]);
  });
});

describe("stillRecurring", () => {
  const [gym] = recurringInWindow(
    monthlySeries("gym", new Date(2026, 0, 5), 6),
    trailingCadence(new Date(2026, 5, 30))
  );

  it("keeps a monthly payment within a month of its last charge", () => {
    expect(gym && stillRecurring(gym, new Date(2026, 5, 30))).toBe(true);
  });

  it("drops a monthly payment that stopped", () => {
    expect(gym && stillRecurring(gym, new Date(2026, 8, 15))).toBe(false);
  });
});

const monthlyAmounts = (
  merchantKey: string,
  first: Date,
  amounts: number[]
): RecurrenceTransaction[] =>
  amounts.map((amount, index) => ({
    amount: -amount,
    category: "bills-utilities",
    counterpartyName: merchantKey,
    currency: "EUR",
    date: new Date(first.getFullYear(), first.getMonth() + index, 5),
    merchantKey,
    resolvedCategory: null,
  }));

const weeklyAmounts = (
  merchantKey: string,
  first: Date,
  amounts: number[]
): RecurrenceTransaction[] =>
  amounts.map((amount, index) => ({
    amount: -amount,
    category: "restaurants",
    counterpartyName: merchantKey,
    currency: "EUR",
    date: new Date(first.getTime() + index * 7 * DAY_MS),
    merchantKey,
    resolvedCategory: null,
  }));

describe("classifyRecurrence", () => {
  const monthly = { frequency: "monthly", intervalSpread: 0 } as const;

  it("confirms a scheduled charge that repeats at the same price", () => {
    expect(
      classifyRecurrence({
        ...monthly,
        amountSpread: STABLE_AMOUNT_SPREAD,
        occurrences: 3,
      })
    ).toEqual({ confidence: "confirmed", kind: "fixed" });
  });

  it("holds back to likely just past the stable-amount threshold", () => {
    expect(
      classifyRecurrence({
        ...monthly,
        amountSpread: STABLE_AMOUNT_SPREAD + 0.01,
        occurrences: 12,
      })
    ).toEqual({ confidence: "likely", kind: "fixed" });
  });

  it("holds back to likely while the evidence is two occurrences", () => {
    expect(
      classifyRecurrence({ ...monthly, amountSpread: 0, occurrences: 2 })
    ).toEqual({ confidence: "likely", kind: "fixed" });
  });

  it("keeps a bill fixed up to the variable-amount threshold", () => {
    expect(
      classifyRecurrence({
        ...monthly,
        amountSpread: VARIABLE_AMOUNT_SPREAD,
        occurrences: 12,
      })
    ).toEqual({ confidence: "likely", kind: "fixed" });
  });

  it("reads a habit past the variable-amount threshold as behavioral", () => {
    expect(
      classifyRecurrence({
        ...monthly,
        amountSpread: VARIABLE_AMOUNT_SPREAD + 0.01,
        occurrences: 12,
      })
    ).toEqual({ confidence: "pattern", kind: "behavioral" });
  });

  it("keeps a commitment fixed up to the regular-interval threshold", () => {
    expect(
      classifyRecurrence({
        amountSpread: 0,
        frequency: "monthly",
        intervalSpread: REGULAR_INTERVAL_SPREAD,
        occurrences: 6,
      })
    ).toEqual({ confidence: "confirmed", kind: "fixed" });
  });

  it("reads a cadence past the regular-interval threshold as behavioral", () => {
    expect(
      classifyRecurrence({
        amountSpread: 0,
        frequency: "monthly",
        intervalSpread: REGULAR_INTERVAL_SPREAD + 0.01,
        occurrences: 6,
      })
    ).toEqual({ confidence: "pattern", kind: "behavioral" });
  });

  it("never calls an irregular cadence a commitment", () => {
    expect(
      classifyRecurrence({
        amountSpread: 0,
        frequency: "irregular",
        intervalSpread: 0,
        occurrences: 12,
      })
    ).toEqual({ confidence: "pattern", kind: "behavioral" });
  });
});

describe("recurringInWindow classification", () => {
  const asOf = new Date(2026, 8, 15);
  const window = { from: new Date(asOf.getTime() - WINDOW_MS), to: asOf };

  it("confirms a monthly charge with an identical amount", () => {
    const [detected] = recurringInWindow(
      monthlySeries("netflix", new Date(2025, 9, 5), 6),
      window
    );

    expect(detected?.kind).toBe("fixed");
    expect(detected?.confidence).toBe("confirmed");
    expect(detected?.amountSpread).toBe(0);
  });

  it("keeps a monthly bill fixed but only likely when its amount moves", () => {
    const [detected] = recurringInWindow(
      monthlyAmounts(
        "edf",
        new Date(2025, 9, 5),
        [1275, 1725, 1275, 1725, 1275, 1725]
      ),
      window
    );

    expect(detected?.kind).toBe("fixed");
    expect(detected?.confidence).toBe("likely");
    expect(detected?.amountSpread).toBeCloseTo(0.15, 5);
  });

  it("reads a frequent merchant with a moving amount as a habit", () => {
    const [detected] = recurringInWindow(
      weeklyAmounts(
        "boulangerie",
        new Date(2026, 1, 2),
        [600, 2400, 600, 2400, 600, 2400, 600, 2400]
      ),
      window
    );

    expect(detected?.frequency).toBe("weekly");
    expect(detected?.kind).toBe("behavioral");
    expect(detected?.confidence).toBe("pattern");
    expect(detected?.amountSpread).toBeCloseTo(0.6, 5);
  });

  it("tolerates a posting date that slips a few days", () => {
    const postingDaysOfMonth = [5, 7, 4, 6, 5, 8];
    const [detected] = recurringInWindow(
      postingDaysOfMonth.map((day, index) => ({
        amount: -1500,
        category: "bills-utilities",
        counterpartyName: "landlord",
        currency: "EUR",
        date: new Date(2025, 9 + index, day),
        merchantKey: "landlord",
        resolvedCategory: null,
      })),
      window
    );

    expect(detected?.frequency).toBe("monthly");
    expect(detected?.kind).toBe("fixed");
    expect(detected?.confidence).toBe("confirmed");
    expect(detected?.intervalSpread).toBeGreaterThan(0);
    expect(detected?.intervalSpread).toBeLessThanOrEqual(
      REGULAR_INTERVAL_SPREAD
    );
  });
});

const unmatched = (
  merchantKey: string | null,
  amount: number,
  date: Date
): RecurrenceTransaction => ({
  amount: -amount,
  category: "shopping",
  counterpartyName: merchantKey,
  currency: "EUR",
  date,
  merchantKey,
  resolvedCategory: null,
});

describe("recurringMonthsInWindow", () => {
  const asOf = new Date(2026, 8, 15);
  const window = { from: new Date(asOf.getTime() - WINDOW_MS), to: asOf };

  const transactions = [
    ...monthlySeries("netflix", new Date(2025, 11, 5), 6),
    ...weeklyAmounts(
      "boulangerie",
      new Date(2026, 1, 2),
      [600, 2400, 600, 2400, 600, 2400, 600, 2400]
    ),
    unmatched(null, 999, new Date(2026, 1, 10)),
    unmatched("one-off", 111, new Date(2026, 1, 12)),
    unmatched(null, 5000, new Date(2024, 4, 1)),
  ];

  const months = recurringMonthsInWindow(
    transactions,
    window,
    recurringInWindow(transactions, window)
  );

  it("splits a month by what its spending is committed to", () => {
    expect(months.find((m) => m.month === "2026-02")).toEqual({
      behavioralMinor: 6000,
      discretionaryMinor: 1110,
      fixedMinor: 1500,
      month: "2026-02",
    });
  });

  it("keys months 1-based and zero-padded, oldest first", () => {
    expect(months.map((m) => m.month)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
    ]);
  });

  it("ignores spending outside the window", () => {
    expect(months.some((m) => m.month === "2024-05")).toBe(false);
  });
});

const subscriptionCharge = (
  date: Date,
  amount: number,
  original: { amount: number; currency: string } | null
): RecurrenceTransaction => ({
  amount: -amount,
  category: "subscriptions",
  counterpartyName: "github",
  currency: "EUR",
  date,
  merchantKey: "github",
  originalAmount: original === null ? null : -original.amount,
  originalCurrency: original === null ? null : original.currency,
  resolvedCategory: null,
});

describe("stableAmounts", () => {
  const may = new Date(2026, 4, 5);

  it("reads the amounts the merchant charged when all share one original currency", () => {
    expect(
      stableAmounts([
        subscriptionCharge(may, 920, { amount: 1000, currency: "USD" }),
        subscriptionCharge(may, 905, { amount: 1000, currency: "USD" }),
      ])
    ).toEqual([1000, 1000]);
  });

  it("reads the booked amounts when one charge has no original", () => {
    expect(
      stableAmounts([
        subscriptionCharge(may, 920, { amount: 1000, currency: "USD" }),
        subscriptionCharge(may, 905, null),
      ])
    ).toEqual([920, 905]);
  });

  it("reads the booked amounts when the originals are in different currencies", () => {
    expect(
      stableAmounts([
        subscriptionCharge(may, 920, { amount: 1000, currency: "USD" }),
        subscriptionCharge(may, 905, { amount: 800, currency: "GBP" }),
      ])
    ).toEqual([920, 905]);
  });
});

describe("recurringInWindow in a foreign currency", () => {
  const asOf = new Date(2026, 8, 15);
  const window = { from: new Date(asOf.getTime() - WINDOW_MS), to: asOf };
  const bookedInEuros = [840, 990, 850, 1000, 860, 980];

  it("confirms a dollar subscription billed in euros that move with the rate", () => {
    const [detected] = recurringInWindow(
      bookedInEuros.map((amount, index) =>
        subscriptionCharge(new Date(2025, 9 + index, 5), amount, {
          amount: 1000,
          currency: "USD",
        })
      ),
      window
    );

    expect(detected?.amountSpread).toBe(0);
    expect(detected?.kind).toBe("fixed");
    expect(detected?.confidence).toBe("confirmed");
  });

  it("only reaches likely without the original amounts", () => {
    const [detected] = recurringInWindow(
      bookedInEuros.map((amount, index) =>
        subscriptionCharge(new Date(2025, 9 + index, 5), amount, null)
      ),
      window
    );

    expect(detected?.amountSpread).toBeGreaterThan(STABLE_AMOUNT_SPREAD);
    expect(detected?.confidence).toBe("likely");
  });

  it("keeps only the charges in the currency of the last one", () => {
    const charges = monthlySeries("netflix", new Date(2025, 9, 5), 6).map(
      (charge, index) => (index < 2 ? { ...charge, currency: "GBP" } : charge)
    );

    const [detected] = recurringInWindow(charges, window);

    expect(detected?.currency).toBe("EUR");
    expect(detected?.occurrences).toBe(4);
  });
});

describe("recurringMonthsInWindow with a converter", () => {
  const asOf = new Date(2026, 8, 15);
  const window = { from: new Date(asOf.getTime() - WINDOW_MS), to: asOf };
  const dollars = converterOf(
    "EUR",
    rateBookOf([
      {
        currency: "USD",
        date: new Date("2026-01-01T00:00:00Z"),
        ratePerEur: 1.25,
      },
    ])
  );

  const inDollars = (amount: number, date: Date): RecurrenceTransaction => ({
    ...unmatched("shop", amount, date),
    currency: "USD",
  });

  const inPounds = (amount: number, date: Date): RecurrenceTransaction => ({
    ...unmatched("shop", amount, date),
    currency: "GBP",
  });

  const transactions = [
    unmatched("bakery", 1000, new Date(2026, 2, 3)),
    inDollars(2500, new Date(2026, 2, 10)),
    inPounds(4000, new Date(2026, 2, 12)),
  ];

  it("adds each transaction as the converter values it and skips what it cannot", () => {
    expect(
      recurringMonthsInWindow(transactions, window, [], (tx) =>
        dollars.amountOf(tx)
      )
    ).toEqual([
      {
        behavioralMinor: 0,
        discretionaryMinor: 3000,
        fixedMinor: 0,
        month: "2026-03",
      },
    ]);
  });
});
