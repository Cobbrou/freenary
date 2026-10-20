import { describe, expect, it } from "bun:test";

import type { SpendingCategory } from "../lib/taxonomy";
import type {
  CachedClassification,
  ClassificationRecord,
  ClassificationStore,
} from "./classifier/store";
import type {
  ClassificationInput,
  ClassificationPrediction,
  TransactionClassifier,
} from "./classifier/types";
import {
  categoriseBatch,
  categoriseTransaction,
  merchantKeyCandidates,
} from "./resolve";
import type { CategoriseInput } from "./types";

interface ScriptedClassifier extends TransactionClassifier {
  calls: number;
}

const DAYS_BEFORE_A_RETRY = 31;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STALE_ABSTENTION: CachedClassification = {
  category: null,
  classifiedAt: new Date(Date.now() - DAYS_BEFORE_A_RETRY * MS_PER_DAY),
  confidence: null,
};

const baseInput: CategoriseInput = {
  amountMinor: -1500,
  channel: "card",
  currency: "EUR",
  merchantKey: "carrefour market",
  normalisedDescriptor: "carrefour market",
  path: "card",
  rawDescriptor: "CARTE 12/03 CARREFOUR MARKET PARIS",
  userId: "test-user",
};

describe("categoriseTransaction", () => {
  describe("channel short-circuit", () => {
    it("returns cash-withdrawal for ATM channel", async () => {
      const categorised = await categoriseTransaction({
        ...baseInput,
        channel: "atm",
      });

      expect(categorised.stage).toBe("channel");
      expect(categorised.category).toBe("cash-withdrawal");
      expect(categorised.band).toBe("auto");
      expect(categorised.confidence).toBe(0.9);
    });

    it("returns loans-bank-fees for fee channel", async () => {
      const categorised = await categoriseTransaction({
        ...baseInput,
        channel: "fee",
      });

      expect(categorised.stage).toBe("channel");
      expect(categorised.category).toBe("loans-bank-fees");
    });

    it("returns uncategorised for cheque channel", async () => {
      const categorised = await categoriseTransaction({
        ...baseInput,
        channel: "cheque",
      });

      expect(categorised.stage).toBe("channel");
      expect(categorised.category).toBe("uncategorised");
    });
  });

  describe("empty merchant key", () => {
    it("returns unknown when nothing else carries a signal", async () => {
      const categorised = await categoriseTransaction({
        ...baseInput,
        merchantKey: "",
        normalisedDescriptor: "unknown merchant xyz abc",
      });

      expect(categorised.stage).toBe("none");
      expect(categorised.band).toBe("unknown");
      expect(categorised.category).toBeNull();
    });

    it("still runs the deterministic layer without a merchant key", async () => {
      const categorised = await categoriseTransaction({
        ...baseInput,
        merchantCategoryCode: "5411",
        merchantKey: "",
        normalisedDescriptor: "",
      });

      expect(categorised.stage).toBe("mcc");
      expect(categorised.category).toBe("groceries");
    });
  });

  describe("deterministic layer", () => {
    it("uses MCC when no earlier stage matches", async () => {
      const categorised = await categoriseTransaction({
        ...baseInput,
        merchantCategoryCode: "5411",
        merchantKey: "unknown-merchant-xyz-abc",
        normalisedDescriptor: "unknown-merchant-xyz-abc",
      });

      expect(categorised.stage).toBe("mcc");
      expect(categorised.category).toBe("groceries");
      expect(categorised.band).toBe("auto");
    });

    it("uses this country's rules when no code is reported", async () => {
      const categorised = await categoriseTransaction({
        ...baseInput,
        bankTransactionCode: "PRLV LOYER",
        country: "FR",
        merchantKey: "unknown-merchant-xyz-abc",
        normalisedDescriptor: "unknown-merchant-xyz-abc",
      });

      expect(categorised.stage).toBe("rules");
      expect(categorised.category).toBe("rent-mortgage");
      expect(categorised.band).toBe("auto");
    });

    it("uses transport-travel across the issuer-assigned 3000-3999 range", async () => {
      const results = await Promise.all(
        ["3001", "3351", "3501"].map((merchantCategoryCode) =>
          categoriseTransaction({
            ...baseInput,
            merchantCategoryCode,
            merchantKey: "unknown-merchant-xyz-abc",
            normalisedDescriptor: "unknown-merchant-xyz-abc",
          })
        )
      );

      for (const categorised of results) {
        expect(categorised.stage).toBe("mcc");
        expect(categorised.category).toBe("transport-travel");
      }
    });
  });

  describe("error resilience", () => {
    it("never throws, returns unknown on error", async () => {
      // SAFETY: deliberately passing empty object to test error resilience
      const categorised = await categoriseTransaction({} as CategoriseInput);

      expect(categorised.band).toBe("unknown");
      expect(categorised.stage).toBe("none");
    });
  });

  describe("direction invariant", () => {
    it("refuses an outgoing-only dictionary hit on a credit", async () => {
      const categorised = await categoriseTransaction({
        ...baseInput,
        amountMinor: 4200,
      });

      expect(categorised.category).toBeNull();
    });

    it("keeps that same merchant on a debit", async () => {
      const categorised = await categoriseTransaction(baseInput);

      expect(categorised).toMatchObject({
        category: "groceries",
        stage: "dictionary",
      });
    });
  });
});

const scriptedClassifier = (
  answer: () => Promise<ClassificationPrediction | null>,
  provider = "test"
): ScriptedClassifier => ({
  calls: 0,
  classify(input: ClassificationInput) {
    void input;
    this.calls += 1;

    return answer();
  },
  model: `${provider}-model`,
  provider,
});

const memoryStore = (): ClassificationStore & {
  rows: Map<string, ClassificationRecord>;
} => {
  const rows = new Map<string, ClassificationRecord>();
  const times = new Map<string, Date>();

  return {
    find: (signature) => {
      const row = rows.get(signature);

      return Promise.resolve(
        row
          ? {
              category: row.category,
              classifiedAt: times.get(signature) ?? new Date(),
              confidence: row.confidence,
            }
          : null
      );
    },
    rows,
    save: (signature, record) => {
      rows.set(signature, record);
      times.set(signature, new Date());

      return Promise.resolve();
    },
  };
};

const unresolved: CategoriseInput = {
  ...baseInput,
  merchantKey: "unknown-merchant-xyz-abc",
  normalisedDescriptor: "unknown merchant xyz abc",
};

const weak = () =>
  Promise.resolve({ category: "groceries", confidence: 0.6 } as const);

const strong = () =>
  Promise.resolve({ category: "restaurants", confidence: 0.92 } as const);

describe("categoriseBatch", () => {
  it("never asks the classifier about a transaction a deterministic stage resolved", async () => {
    const classifier = scriptedClassifier(() =>
      Promise.resolve({ category: "groceries", confidence: 0.9 })
    );

    const store = memoryStore();

    const results = await categoriseBatch(
      [
        { ...unresolved, merchantCategoryCode: "5411" },
        { ...baseInput, channel: "atm" },
      ],
      { classifiers: [classifier], countries: undefined, store }
    );

    expect(results.map((categorised) => categorised.stage)).toEqual([
      "mcc",
      "channel",
    ]);

    expect(classifier.calls).toBe(0);
    expect(store.rows.size).toBe(0);
  });

  it("leaves a merchant unresolved when no classifier is configured", async () => {
    const store = memoryStore();

    const [categorised] = await categoriseBatch([unresolved], {
      classifiers: [],
      countries: undefined,
      store,
    });

    expect(categorised?.stage).toBe("none");
    expect(categorised?.category).toBeNull();
    expect(store.rows.size).toBe(0);
  });

  it("stores and applies a category the classifier answered", async () => {
    const classifier = scriptedClassifier(() =>
      Promise.resolve({
        answeredBy: "test-model-1",
        category: "groceries",
        confidence: 0.9,
      })
    );

    const store = memoryStore();

    const [categorised] = await categoriseBatch([unresolved], {
      classifiers: [classifier],
      countries: undefined,
      store,
    });

    expect(categorised).toMatchObject({
      band: "auto",
      category: "groceries",
      confidence: 0.9,
      stage: "model",
    });

    expect([...store.rows.values()]).toEqual([
      {
        answeredBy: "test-model-1",
        category: "groceries",
        classifier,
        confidence: 0.9,
      },
    ]);
  });

  it("refuses a prediction the transaction's direction cannot take", async () => {
    const classifier = scriptedClassifier(() =>
      Promise.resolve({ category: "groceries" as const, confidence: 0.9 })
    );

    const store = memoryStore();

    const [categorised] = await categoriseBatch(
      [{ ...unresolved, amountMinor: 4200 }],
      { classifiers: [classifier], countries: undefined, store }
    );

    expect(categorised?.category).toBeNull();
    expect(store.rows.size).toBe(0);
  });

  it("accepts a both-direction prediction on a credit", async () => {
    const classifier = scriptedClassifier(() =>
      Promise.resolve({ category: "people" as const, confidence: 0.9 })
    );

    const store = memoryStore();

    const [categorised] = await categoriseBatch(
      [{ ...unresolved, amountMinor: 4200 }],
      { classifiers: [classifier], countries: undefined, store }
    );

    expect(categorised?.category).toBe("people");
  });

  it("asks once per merchant identity, whatever the amounts", async () => {
    const classifier = scriptedClassifier(() =>
      Promise.resolve({ category: "groceries", confidence: 0.9 })
    );

    const store = memoryStore();

    const results = await categoriseBatch(
      [
        { ...unresolved, amountMinor: -500 },
        { ...unresolved, amountMinor: -90_000 },
      ],
      { classifiers: [classifier], countries: undefined, store }
    );

    expect(classifier.calls).toBe(1);
    expect(results.map((categorised) => categorised.stage)).toEqual([
      "model",
      "model",
    ]);
  });

  it("reports once per merchant identity it settled", async () => {
    const classifier = scriptedClassifier(() =>
      Promise.resolve({ category: "groceries", confidence: 0.9 })
    );

    const settled: number[] = [];

    await categoriseBatch(
      [
        { ...unresolved, amountMinor: -500 },
        { ...unresolved, amountMinor: -90_000 },
        { ...unresolved, merchantKey: "other shop" },
      ],
      {
        classifiers: [classifier],
        countries: undefined,
        onSignatureSettled: () => {
          settled.push(settled.length);

          return Promise.resolve();
        },
        store: memoryStore(),
      }
    );

    expect(settled).toHaveLength(2);
  });

  it("reuses a stored answer on the next batch", async () => {
    const store = memoryStore();
    const first = scriptedClassifier(() =>
      Promise.resolve({ category: "groceries", confidence: 0.9 })
    );

    await categoriseBatch([unresolved], {
      classifiers: [first],
      countries: undefined,
      store,
    });

    const second = scriptedClassifier(() =>
      Promise.resolve({ category: "groceries", confidence: 0.9 })
    );

    const [categorised] = await categoriseBatch([unresolved], {
      classifiers: [second],
      countries: undefined,
      store,
    });

    expect(second.calls).toBe(0);
    expect(categorised?.stage).toBe("cached-model");
    expect(categorised?.category).toBe("groceries");
  });

  it("caches an abstention and retries it after a month", async () => {
    const store = memoryStore();
    const abstaining = scriptedClassifier(() => Promise.resolve(null));

    const [categorised] = await categoriseBatch([unresolved], {
      classifiers: [abstaining],
      countries: undefined,
      store,
    });

    expect(categorised?.stage).toBe("none");
    expect([...store.rows.values()]).toMatchObject([{ category: null }]);

    const soon = scriptedClassifier(() => Promise.resolve(null));
    await categoriseBatch([unresolved], {
      classifiers: [soon],
      countries: undefined,
      store,
    });

    expect(soon.calls).toBe(0);

    const stale = { ...store, find: () => Promise.resolve(STALE_ABSTENTION) };
    const later = scriptedClassifier(() => Promise.resolve(null));
    await categoriseBatch([unresolved], {
      classifiers: [later],
      countries: undefined,
      store: stale,
    });

    expect(later.calls).toBe(1);
  });

  it("refuses an answer outside the taxonomy and caches nothing", async () => {
    const classifier = scriptedClassifier(() =>
      Promise.resolve({
        category: "not-a-category" as SpendingCategory,
        confidence: 0.9,
      })
    );

    const store = memoryStore();

    const [categorised] = await categoriseBatch([unresolved], {
      classifiers: [classifier],
      countries: undefined,
      store,
    });

    expect(categorised?.stage).toBe("none");
    expect(store.rows.size).toBe(0);
  });

  it("survives a classifier that throws, and caches nothing", async () => {
    const classifier = scriptedClassifier(() =>
      Promise.reject(new Error("provider down"))
    );

    const store = memoryStore();

    const [categorised] = await categoriseBatch([unresolved], {
      classifiers: [classifier],
      countries: undefined,
      store,
    });

    expect(categorised?.stage).toBe("none");
    expect(store.rows.size).toBe(0);
  });

  it("gives up on a classifier that never answers, and caches nothing", async () => {
    const held = Promise.withResolvers<ClassificationPrediction | null>();
    const classifier = scriptedClassifier(() => held.promise);
    const store = memoryStore();

    const [categorised] = await categoriseBatch([unresolved], {
      classifiers: [classifier],
      countries: undefined,
      store,
      timeoutMs: 1,
    });

    held.resolve(null);

    expect(classifier.calls).toBe(1);
    expect(categorised?.stage).toBe("none");
    expect(store.rows.size).toBe(0);
  });

  it("escalates an answer below the bar to the next classifier", async () => {
    const asked = scriptedClassifier(
      () => Promise.resolve({ category: "groceries", confidence: 0.6 }),
      "local"
    );

    const escalated = scriptedClassifier(
      () => Promise.resolve({ category: "restaurants", confidence: 0.92 }),
      "hosted"
    );

    const store = memoryStore();

    const [categorised] = await categoriseBatch([unresolved], {
      classifiers: [asked, escalated],
      countries: undefined,
      store,
    });

    expect(asked.calls).toBe(1);
    expect(escalated.calls).toBe(1);
    expect(categorised).toMatchObject({
      band: "auto",
      category: "restaurants",
      confidence: 0.92,
      stage: "model",
    });
  });

  it("keeps the stronger answer when the escalation answers weaker", async () => {
    const asked = scriptedClassifier(
      () => Promise.resolve({ category: "groceries", confidence: 0.7 }),
      "local"
    );

    const escalated = scriptedClassifier(
      () => Promise.resolve({ category: "restaurants", confidence: 0.55 }),
      "hosted"
    );

    const [categorised] = await categoriseBatch([unresolved], {
      classifiers: [asked, escalated],
      countries: undefined,
      store: memoryStore(),
    });

    expect(categorised).toMatchObject({
      band: "suggest",
      category: "groceries",
      confidence: 0.7,
    });
  });

  it("never asks the next classifier about an answer above the bar", async () => {
    const asked = scriptedClassifier(
      () => Promise.resolve({ category: "groceries", confidence: 0.9 }),
      "local"
    );

    const escalated = scriptedClassifier(
      () => Promise.resolve({ category: "restaurants", confidence: 0.99 }),
      "hosted"
    );

    const [categorised] = await categoriseBatch([unresolved], {
      classifiers: [asked, escalated],
      countries: undefined,
      store: memoryStore(),
    });

    expect(escalated.calls).toBe(0);
    expect(categorised?.category).toBe("groceries");
  });

  it("escalates an abstention", async () => {
    const asked = scriptedClassifier(() => Promise.resolve(null), "local");
    const escalated = scriptedClassifier(
      () => Promise.resolve({ category: "restaurants", confidence: 0.9 }),
      "hosted"
    );

    const store = memoryStore();

    const [categorised] = await categoriseBatch([unresolved], {
      classifiers: [asked, escalated],
      countries: undefined,
      store,
    });

    expect(escalated.calls).toBe(1);
    expect(categorised?.category).toBe("restaurants");
    expect([...store.rows.values()]).toMatchObject([
      { category: null },
      { category: "restaurants" },
    ]);
  });

  it("caches every classifier of the chain against its own model", async () => {
    const store = memoryStore();
    await categoriseBatch([unresolved], {
      classifiers: [
        scriptedClassifier(weak, "local"),
        scriptedClassifier(strong, "hosted"),
      ],
      countries: undefined,
      store,
    });

    expect(store.rows.size).toBe(2);

    const asked = scriptedClassifier(weak, "local");
    const escalated = scriptedClassifier(strong, "hosted");
    const [categorised] = await categoriseBatch([unresolved], {
      classifiers: [asked, escalated],
      countries: undefined,
      store,
    });

    expect(asked.calls).toBe(0);
    expect(escalated.calls).toBe(0);
    expect(categorised).toMatchObject({
      band: "auto",
      category: "restaurants",
      stage: "cached-model",
    });
  });

  it("escalates nothing but an abstention when the bar is zero", async () => {
    const asked = scriptedClassifier(
      () => Promise.resolve({ category: "groceries", confidence: 0.6 }),
      "local"
    );

    const escalated = scriptedClassifier(
      () => Promise.resolve({ category: "restaurants", confidence: 0.99 }),
      "hosted"
    );

    const [categorised] = await categoriseBatch([unresolved], {
      classifiers: [asked, escalated],
      countries: undefined,
      escalateBelow: 0,
      store: memoryStore(),
    });

    expect(escalated.calls).toBe(0);
    expect(categorised).toMatchObject({
      band: "suggest",
      category: "groceries",
    });
  });
});

describe("merchantKeyCandidates", () => {
  it("tries the key itself before any relaxation", () => {
    expect(merchantKeyCandidates("carrefour market", "FR")).toEqual([
      "carrefour market",
    ]);
  });

  it("drops trailing service words one at a time, longest key first", () => {
    expect(merchantKeyCandidates("free internet fibre", "FR")).toEqual([
      "free internet fibre",
      "free internet",
      "free",
    ]);
  });

  it("stops at the first token that is not a service word", () => {
    expect(merchantKeyCandidates("forfait mobile", "FR")).toEqual([
      "forfait mobile",
      "forfait",
    ]);

    expect(merchantKeyCandidates("halls beer mobile", "FR")).toEqual([
      "halls beer mobile",
      "halls beer",
    ]);
  });

  it("keeps a country's own service words out of other countries", () => {
    expect(merchantKeyCandidates("edf electricite", "DE")).toEqual([
      "edf electricite",
    ]);
  });

  it("refuses to strip down to an initial", () => {
    expect(merchantKeyCandidates("t mobile", "FR")).toEqual(["t mobile"]);
  });
});
