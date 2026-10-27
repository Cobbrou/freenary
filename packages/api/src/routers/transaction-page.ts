export interface TransactionPage<Transaction> {
  readonly nextCursor: string | null;
  readonly transactions: readonly Transaction[];
}

export const transactionPage = <Transaction extends { readonly id: string }>(
  fetched: readonly Transaction[],
  limit: number
): TransactionPage<Transaction> => {
  if (fetched.length <= limit) {
    return { nextCursor: null, transactions: fetched };
  }

  const transactions = fetched.slice(0, limit);

  return { nextCursor: transactions.at(-1)?.id ?? null, transactions };
};
