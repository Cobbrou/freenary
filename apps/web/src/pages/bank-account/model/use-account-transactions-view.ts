import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import {
  nextTransactionListSearch,
  TRANSACTION_LIST_SEARCH_DEFAULTS,
} from "@/features/transaction-list";
import type {
  SortMode,
  TransactionDirection,
  TransactionListSearch,
  TransactionsInput,
} from "@/features/transaction-list";

const route = getRouteApi("/_auth/accounts/$accountId");

const EARLIEST_BANK_DATE = new Date(0);
const LAST_HOUR = 23;
const LAST_MINUTE = 59;
const LAST_SECOND = 59;
const LAST_MILLISECOND = 999;

const endOfToday = () => {
  const end = new Date();
  end.setHours(LAST_HOUR, LAST_MINUTE, LAST_SECOND, LAST_MILLISECOND);

  return end;
};

export const useAccountTransactionsView = () => {
  const { accountId } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const to = useMemo(() => endOfToday(), []);

  const applyPatch = useCallback(
    (patch: TransactionListSearch) => {
      navigate({
        replace: true,
        resetScroll: false,
        search: (prev) => nextTransactionListSearch(prev, patch),
      });
    },
    [navigate]
  );

  const filters = useMemo(() => search.filters ?? [], [search.filters]);
  const direction: TransactionDirection =
    search.dir ?? TRANSACTION_LIST_SEARCH_DEFAULTS.dir;

  const sort: SortMode = search.sort ?? TRANSACTION_LIST_SEARCH_DEFAULTS.sort;
  const searchQuery = search.q ?? TRANSACTION_LIST_SEARCH_DEFAULTS.q;

  const listInput = useMemo<TransactionsInput>(
    () => ({
      accountId,
      direction,
      filters,
      from: EARLIEST_BANK_DATE,
      search: searchQuery,
      sort,
      to,
    }),
    [accountId, direction, filters, searchQuery, sort, to]
  );

  return { accountId, applyPatch, listInput };
};
