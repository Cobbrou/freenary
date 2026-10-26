import { describe, expect, test } from "bun:test";

import type { TransactionPage } from "./transaction-page";
import { transactionPage } from "./transaction-page";

interface StoredTransaction {
  readonly amount: number;
  readonly id: string;
}

const PAGE_SIZE = 50;

const storedTransactions: readonly StoredTransaction[] = Array.from(
  { length: 120 },
  (_, index) => ({
    amount: ((index * 37) % 101) - 50,
    id: `tx-${String(index).padStart(3, "0")}`,
  })
);

const prismaFindMany = (
  ordered: readonly StoredTransaction[],
  take: number,
  cursor: string | null
): readonly StoredTransaction[] => {
  const start =
    cursor === null
      ? 0
      : ordered.findIndex((transaction) => transaction.id === cursor) + 1;

  return ordered.slice(start, start + take);
};

const followEveryPage = (
  ordered: readonly StoredTransaction[]
): readonly StoredTransaction[] => {
  const received: StoredTransaction[] = [];
  let cursor: string | null = null;

  do {
    const page: TransactionPage<StoredTransaction> = transactionPage(
      prismaFindMany(ordered, PAGE_SIZE + 1, cursor),
      PAGE_SIZE
    );

    received.push(...page.transactions);
    cursor = page.nextCursor;
  } while (cursor !== null);

  return received;
};

const byDate = storedTransactions.toSorted((left, right) =>
  right.id.localeCompare(left.id)
);

const byAmount = storedTransactions.toSorted(
  (left, right) => left.amount - right.amount || right.id.localeCompare(left.id)
);

describe("transaction page", () => {
  test("following the cursor by date returns every transaction once, in order", () => {
    expect(followEveryPage(byDate)).toEqual(byDate);
  });

  test("following the cursor by amount returns every transaction once, in order", () => {
    expect(followEveryPage(byAmount)).toEqual(byAmount);
  });

  test("a period that fits on one page has no next cursor", () => {
    const page = transactionPage(byDate.slice(0, PAGE_SIZE), PAGE_SIZE);

    expect(page.nextCursor).toBeNull();
    expect(page.transactions).toHaveLength(PAGE_SIZE);
  });
});
