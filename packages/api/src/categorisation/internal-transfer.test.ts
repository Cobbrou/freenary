import { describe, expect, it } from "bun:test";

import { rateBookOf } from "../fx/rate-book";
import {
  generateAccounts,
  generateTransactions,
} from "../providers/mock/generate";
import {
  exchangeFeeOf,
  matchInternalTransfers,
  pairedLegs,
  transferCandidateOf,
  transferCandidatesWhere,
  transferLegUpdates,
} from "./internal-transfer";
import type { TransferCandidate, TransferPair } from "./internal-transfer";

describe("matchInternalTransfers", () => {
  it("returns 0 for non-existent user", async () => {
    const matched = await matchInternalTransfers("nonexistent-user-id", null);

    expect(matched).toBe(0);
  });

  it("never throws on empty input", async () => {
    const matched = await matchInternalTransfers("", null);

    expect(matched).toBe(0);
  });
});

const leg = (id: string, accountId: string, amount: number) => ({
  accountId,
  amount,
  currency: "EUR",
  date: new Date("2026-05-02T00:00:00Z"),
  id,
});

describe("transferLegUpdates", () => {
  const accountTypes = new Map([
    ["checking", "CHECKING"],
    ["joint", "CHECKING"],
    ["livret", "LIVRET_A"],
    ["pea", "PEA"],
  ]);

  it("files the current account leg of a deposit by where the money went", () => {
    const pairs = pairedLegs([
      leg("to-livret", "checking", -20_000),
      leg("livret-in", "livret", 20_000),
      leg("to-pea", "checking", -15_000),
      leg("pea-in", "pea", 15_000),
    ]);

    const { flagged, saved } = transferLegUpdates(pairs, accountTypes);

    expect(flagged.toSorted()).toEqual(
      ["livret-in", "pea-in", "to-livret", "to-pea"].toSorted()
    );

    expect(saved).toEqual(
      new Map([
        ["savings", ["to-livret"]],
        ["securities", ["to-pea"]],
      ])
    );
  });

  it("leaves a move between two current accounts or out of savings without a category", () => {
    const pairs = pairedLegs([
      leg("to-joint", "checking", -5000),
      leg("joint-in", "joint", 5000),
      leg("from-livret", "livret", -8000),
      leg("checking-in", "checking", 8000),
    ]);

    const { flagged, saved } = transferLegUpdates(pairs, accountTypes);

    expect(flagged).toHaveLength(4);
    expect(saved.size).toBe(0);
  });
});

const MAY_SECOND = new Date("2026-05-02T00:00:00Z");
const HOUR_MS = 60 * 60 * 1000;

const dollarRates = rateBookOf([
  { currency: "USD", date: new Date("2026-05-01T00:00:00Z"), ratePerEur: 1.1 },
]);

const foreignLeg = (
  id: string,
  accountId: string,
  amount: number,
  currency: string,
  overrides: Partial<TransferCandidate> = {}
): TransferCandidate => ({
  accountId,
  amount,
  currency,
  date: MAY_SECOND,
  id,
  ...overrides,
});

const pairIds = (pairs: readonly TransferPair[]) =>
  pairs.map((pair) => [pair.outgoing.id, pair.incoming.id]);

const CHECKING_IBAN = "FR7630001007941234567890185";
const LIVRET_IBAN = "FR7630004000031234567890143";
const FRIEND_IBAN = "FR7630006000011234567890189";

interface LegIbans {
  account?: string;
  named?: string;
}

const pairsWithIbans = (out: LegIbans, into: LegIbans) =>
  pairIds(
    pairedLegs([
      foreignLeg("out", "checking", -2000, "EUR", {
        accountIban: out.account,
        counterpartyIban: out.named,
      }),
      foreignLeg("in", "livret", 2000, "EUR", {
        accountIban: into.account,
        counterpartyIban: into.named,
      }),
    ])
  );

describe("pairedLegs with IBANs", () => {
  it("pairs two legs when either one names the other account", () => {
    expect(
      pairsWithIbans(
        { account: CHECKING_IBAN },
        { account: LIVRET_IBAN, named: CHECKING_IBAN }
      )
    ).toEqual([["out", "in"]]);

    expect(
      pairsWithIbans(
        { account: CHECKING_IBAN, named: LIVRET_IBAN },
        { account: LIVRET_IBAN }
      )
    ).toEqual([["out", "in"]]);

    expect(
      pairsWithIbans({ account: CHECKING_IBAN }, { named: CHECKING_IBAN })
    ).toEqual([["out", "in"]]);
  });

  it("refuses two legs when the money came from someone else", () => {
    expect(
      pairsWithIbans(
        { account: CHECKING_IBAN },
        { account: LIVRET_IBAN, named: FRIEND_IBAN }
      )
    ).toEqual([]);

    expect(
      pairsWithIbans(
        { account: CHECKING_IBAN, named: LIVRET_IBAN },
        { account: LIVRET_IBAN, named: FRIEND_IBAN }
      )
    ).toEqual([]);
  });

  it("refuses a named account it cannot match to the other leg", () => {
    expect(pairsWithIbans({ named: FRIEND_IBAN }, {})).toEqual([]);
  });

  it("refuses two known accounts when no leg names the other one", () => {
    expect(
      pairsWithIbans({ account: CHECKING_IBAN }, { account: LIVRET_IBAN })
    ).toEqual([]);
  });

  it("falls back to amount, currency and date without IBANs to compare", () => {
    expect(pairsWithIbans({ account: CHECKING_IBAN }, {})).toEqual([
      ["out", "in"],
    ]);

    expect(
      pairsWithIbans({ account: CHECKING_IBAN }, { account: CHECKING_IBAN })
    ).toEqual([["out", "in"]]);
  });

  it("gives a leg to the pair an IBAN confirms first", () => {
    const pairs = pairedLegs([
      foreignLeg("out", "checking", -2000, "EUR", {
        accountIban: CHECKING_IBAN,
      }),
      foreignLeg("unrelated", "pea", 2000, "EUR"),
      foreignLeg("in", "livret", 2000, "EUR", {
        accountIban: LIVRET_IBAN,
        counterpartyIban: CHECKING_IBAN,
      }),
    ]);

    expect(pairIds(pairs)).toEqual([["out", "in"]]);
  });

  it("refuses legs in two currencies when the money came from someone else", () => {
    expect(
      pairedLegs(
        [
          foreignLeg("eur-out", "checking", -10_000, "EUR", {
            accountIban: CHECKING_IBAN,
          }),
          foreignLeg("usd-in", "dollars", 10_900, "USD", {
            counterpartyIban: FRIEND_IBAN,
          }),
        ],
        dollarRates
      )
    ).toEqual([]);
  });

  it("pairs an exchange inside one account that has an IBAN", () => {
    const pairs = pairedLegs(
      [
        foreignLeg("eur-out", "multi", -10_000, "EUR", {
          accountIban: CHECKING_IBAN,
        }),
        foreignLeg("usd-in", "multi", 10_900, "USD", {
          accountIban: CHECKING_IBAN,
        }),
      ],
      dollarRates
    );

    expect(pairIds(pairs)).toEqual([["eur-out", "usd-in"]]);
  });
});

describe("transferCandidateOf", () => {
  const stored = {
    ...foreignLeg("leg", "checking", -2000, "EUR"),
    creditorAccountIban: "fr76 3000 4000 0312 3456 7890 143",
    debtorAccountIban: CHECKING_IBAN,
  };

  it("takes the creditor of money going out and the debtor of money coming in", () => {
    expect(transferCandidateOf(stored, CHECKING_IBAN).counterpartyIban).toBe(
      LIVRET_IBAN
    );

    expect(
      transferCandidateOf({ ...stored, amount: 2000 }, null).counterpartyIban
    ).toBe(CHECKING_IBAN);
  });

  it("ignores the spacing and case of an IBAN, and reads a blank one as unknown", () => {
    expect(
      transferCandidateOf(stored, " fr7630004000031234567890143 ").accountIban
    ).toBe(LIVRET_IBAN);

    expect(transferCandidateOf(stored, " ").accountIban).toBeNull();
  });
});

describe("pairedLegs on the mock bank", () => {
  const today = new Date("2026-03-31T10:00:00Z");
  const session = "mock_2026-03-01_0f8b6c1e-2d4a-4b7e-9c3f-5a6b7c8d9e0f";
  const accounts = generateAccounts(session, today);

  const candidates = accounts.flatMap(({ iban, providerAccountId }) =>
    generateTransactions(
      providerAccountId,
      "2026-01-01",
      "2026-03-31",
      today
    ).map((tx) =>
      transferCandidateOf(
        {
          accountId: providerAccountId,
          amount: tx.amountMinor,
          creditorAccountIban: tx.creditorIban ?? null,
          currency: tx.currency,
          date: new Date(tx.bookingDate),
          debtorAccountIban: tx.debtorIban ?? null,
          id: tx.providerTransactionId,
        },
        iban
      )
    )
  );

  it("pairs every monthly transfer to the Livret A", () => {
    const intoLivret = pairedLegs(candidates).filter(
      ({ incoming }) => incoming.accountId === `${session}:savings`
    );

    expect(intoLivret.map(({ outgoing }) => outgoing.accountId)).toEqual([
      `${session}:checking`,
      `${session}:checking`,
      `${session}:checking`,
    ]);
  });

  it("leaves a payment alone when a friend sends the same amount that day", () => {
    const livret = accounts.find(({ name }) => name === "Livret A");
    const payment = candidates.find(
      (tx) =>
        tx.accountId === `${session}:checking` &&
        tx.amount < 0 &&
        !tx.counterpartyIban
    );

    expect(livret?.iban).toBeDefined();
    expect(payment).toBeDefined();

    const legs = payment
      ? [
          payment,
          {
            ...payment,
            accountIban: livret?.iban,
            accountId: `${session}:savings`,
            amount: -payment.amount,
            id: "gift",
          },
        ]
      : [];

    expect(pairedLegs(legs)).toEqual([]);
  });
});

describe("transferCandidatesWhere", () => {
  it("leaves out the transactions categorised by hand and the ones already paired", () => {
    expect(
      transferCandidatesWhere(["checking"], new Date("2026-05-02T00:00:00Z"))
    ).toEqual({
      accountId: { in: ["checking"] },
      categoryOverride: false,
      date: { gte: new Date("2026-05-01T00:00:00Z") },
      isInternalTransfer: false,
    });
  });
});

describe("pairedLegs across currencies", () => {
  it("pairs two accounts when the reference rate lands within tolerance", () => {
    const pairs = pairedLegs(
      [
        foreignLeg("eur-out", "checking", -10_000, "EUR"),
        foreignLeg("usd-in", "dollars", 10_800, "USD"),
      ],
      dollarRates
    );

    expect(pairIds(pairs)).toEqual([["eur-out", "usd-in"]]);
    expect(pairs[0]?.exchangeFeeMinor).toBe(182);
  });

  it("pairs an exchange inside one account holding two currencies", () => {
    const pairs = pairedLegs(
      [
        foreignLeg("eur-out", "multi", -10_000, "EUR"),
        foreignLeg("usd-in", "multi", 10_900, "USD", {
          date: new Date(MAY_SECOND.getTime() + HOUR_MS),
        }),
      ],
      dollarRates
    );

    expect(pairIds(pairs)).toEqual([["eur-out", "usd-in"]]);
    expect(pairs[0]?.exchangeFeeMinor).toBe(91);
  });

  it("trusts the amount the bank converted even far from the reference rate", () => {
    const pairs = pairedLegs(
      [
        foreignLeg("eur-out", "checking", -10_000, "EUR", {
          originalAmount: 9500,
          originalCurrency: "USD",
        }),
        foreignLeg("usd-in", "dollars", 9500, "USD"),
      ],
      dollarRates
    );

    expect(pairIds(pairs)).toEqual([["eur-out", "usd-in"]]);
    expect(pairs[0]?.exchangeFeeMinor).toBe(1364);
  });

  it("refuses a pair more than 3% off the reference rate", () => {
    expect(
      pairedLegs(
        [
          foreignLeg("eur-out", "checking", -10_000, "EUR"),
          foreignLeg("usd-in", "dollars", 10_500, "USD"),
        ],
        dollarRates
      )
    ).toEqual([]);
  });

  it("refuses a pair more than a day apart", () => {
    expect(
      pairedLegs(
        [
          foreignLeg("eur-out", "checking", -10_000, "EUR"),
          foreignLeg("usd-in", "dollars", 11_000, "USD", {
            date: new Date(MAY_SECOND.getTime() + 25 * HOUR_MS),
          }),
        ],
        dollarRates
      )
    ).toEqual([]);
  });

  it("chooses the outgoing leg closest to the reference rate", () => {
    const pairs = pairedLegs(
      [
        foreignLeg("further", "checking", -10_000, "EUR"),
        foreignLeg("closer", "joint", -9950, "EUR"),
        foreignLeg("usd-in", "dollars", 10_900, "USD"),
      ],
      dollarRates
    );

    expect(pairIds(pairs)).toEqual([["closer", "usd-in"]]);
  });

  it("does not pair across currencies without rates", () => {
    expect(
      pairedLegs([
        foreignLeg("eur-out", "checking", -10_000, "EUR"),
        foreignLeg("usd-in", "dollars", 11_000, "USD"),
      ])
    ).toEqual([]);
  });

  it("keeps pairing same-currency legs first", () => {
    const pairs = pairedLegs(
      [
        foreignLeg("eur-out", "checking", -10_000, "EUR"),
        foreignLeg("eur-in", "livret", 10_000, "EUR"),
        foreignLeg("usd-in", "dollars", 11_000, "USD"),
      ],
      dollarRates
    );

    expect(pairIds(pairs)).toEqual([["eur-out", "eur-in"]]);
  });
});

describe("exchangeFeeOf", () => {
  it("is what was sent beyond the reference value of what arrived", () => {
    expect(
      exchangeFeeOf(
        foreignLeg("eur-out", "checking", -10_000, "EUR"),
        foreignLeg("usd-in", "dollars", 10_780, "USD"),
        dollarRates
      )
    ).toBe(200);
  });

  it("is zero when more arrived than the reference rate gives", () => {
    expect(
      exchangeFeeOf(
        foreignLeg("eur-out", "checking", -10_000, "EUR"),
        foreignLeg("usd-in", "dollars", 11_200, "USD"),
        dollarRates
      )
    ).toBe(0);
  });

  it("is unknown without a rate for the currency received", () => {
    expect(
      exchangeFeeOf(
        foreignLeg("eur-out", "checking", -10_000, "EUR"),
        foreignLeg("gbp-in", "pounds", 8600, "GBP"),
        dollarRates
      )
    ).toBeNull();
  });
});

describe("transferLegUpdates fees", () => {
  it("reports the exchange fee under the outgoing leg", () => {
    const pairs = pairedLegs(
      [
        foreignLeg("eur-out", "checking", -10_000, "EUR"),
        foreignLeg("usd-in", "dollars", 10_800, "USD"),
        foreignLeg("to-livret", "checking", -5000, "EUR"),
        foreignLeg("livret-in", "livret", 5000, "EUR"),
      ],
      dollarRates
    );

    const { fees } = transferLegUpdates(
      pairs,
      new Map([
        ["checking", "CHECKING"],
        ["dollars", "CHECKING"],
        ["livret", "LIVRET_A"],
      ])
    );

    expect(fees).toEqual(new Map([["eur-out", 182]]));
  });
});
