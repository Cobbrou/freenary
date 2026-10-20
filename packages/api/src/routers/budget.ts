import prisma from "@freenary/db";
import type { Prisma } from "@freenary/db";
import { ORPCError } from "@orpc/server";
import { Data, Effect, Match } from "effect";
import { z } from "zod";

import {
  classifierEscalateBelow,
  transactionClassifiers,
} from "../categorisation/classifier/registry";
import { prismaClassificationStore } from "../categorisation/classifier/store";
import { matchInternalTransfers } from "../categorisation/internal-transfer";
import type { TransactionChannel } from "../categorisation/normalise/types";
import type { RecurringMonthTotals } from "../categorisation/recurrence";
import {
  cadenceWindow,
  detectRecurring,
  detectRecurringExpenses,
  trailingYear,
} from "../categorisation/recurrence";
import { categoriseBatch } from "../categorisation/resolve";
import type { CategoriseInput, TransactionPath } from "../categorisation/types";
import {
  deleteUserOverride,
  upsertUserOverride,
} from "../categorisation/user-override";
import { protectedProcedure } from "../index";
import { findProviderUser } from "../lib/bank-provider-user";
import { syncConnection } from "../lib/bank-sync";
import type { PlannedLine } from "../lib/budget-planned";
import {
  monthSpan,
  periodMonthCount,
  plannedByCategory,
} from "../lib/budget-planned";
import { budgetLineKindOf } from "../lib/budget-profile";
import {
  claimSyncRun,
  createSyncReporter,
  readSyncProgress,
} from "../lib/sync-progress";
import type { SyncReporter } from "../lib/sync-progress";
import {
  CATEGORY_GROUP_OF,
  CATEGORY_GROUPS,
  SPENDING_CATEGORIES,
  categoriesInGroup,
} from "../lib/taxonomy";
import type { CategoryGroup, SpendingCategory } from "../lib/taxonomy";
import {
  effectiveCategory,
  pipelineCategory,
} from "../lib/transaction-category";
import { getProvider } from "../providers/registry";
import { amountBoundsCondition } from "./transaction-amount-bounds";

interface OutgoingRow {
  amount: number;
  category: string | null;
  date: Date;
  merchantKey: string | null;
  resolvedCategory: string | null;
}

interface BudgetLineRow {
  amount: number;
  category: { parentSlug: string | null } | null;
  categorySlug: string | null;
}

interface AccountsSummary {
  availableBalanceMinor: number | null;
  currency: string;
}

interface CashFlowGrain {
  labelExpr: string;
  truncExpr: string;
}

interface TransactionResolution {
  data: {
    intermediaryName: string | null;
    resolutionConfidence: number | null;
    resolutionStage: string | null;
    resolvedCategory: string;
  };
  transactionId: string;
}

type BudgetPipelineReason =
  | { readonly institutionName: string; readonly kind: "connection-sync" }
  | { readonly kind: "categorisation" };

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

const DAILY_GRAIN_MAX_DAYS = 31;

const WEEKLY_GRAIN_MAX_DAYS = 93;

const CASH_FLOW_GRAINS = {
  day: {
    labelExpr: `to_char(t."date", 'YYYY-MM-DD')`,
    truncExpr: `date_trunc('day', t."date")`,
  },
  month: {
    labelExpr: `to_char(date_trunc('month', t."date"), 'YYYY-MM')`,
    truncExpr: `date_trunc('month', t."date")`,
  },
  week: {
    labelExpr: `to_char(date_trunc('week', t."date"), 'YYYY-MM-DD')`,
    truncExpr: `date_trunc('week', t."date")`,
  },
} as const satisfies Record<string, CashFlowGrain>;

const AMOUNT_SIGN_PREDICATE = {
  incoming: 'AND t."amount" > 0',
  outgoing: 'AND t."amount" < 0',
} as const;

const TOP_INCOME_SOURCES = 10;

const OTHER_INCOME_LABEL = "Other Income";

const RECURRING_MONTHS = 12;

const FALLBACK_CURRENCY = "EUR";

const cashFlowGrainFor = (spanDays: number): CashFlowGrain => {
  if (spanDays <= DAILY_GRAIN_MAX_DAYS) {
    return CASH_FLOW_GRAINS.day;
  }

  if (spanDays <= WEEKLY_GRAIN_MAX_DAYS) {
    return CASH_FLOW_GRAINS.week;
  }

  return CASH_FLOW_GRAINS.month;
};

const cashFlowQuery = ({ labelExpr, truncExpr }: CashFlowGrain) =>
  `SELECT
    ${labelExpr} AS label,
    COALESCE(SUM(CASE WHEN t."amount" > 0 THEN t."amount" ELSE 0 END), 0)::bigint AS incoming,
    COALESCE(SUM(CASE WHEN t."amount" < 0 THEN ABS(t."amount") ELSE 0 END), 0)::bigint AS outgoing
  FROM "transaction" t
  JOIN "bank_account" ba ON ba."id" = t."accountId"
  JOIN "bank_connection" bc ON bc."id" = ba."connectionId"
  WHERE bc."userId" = $1
    AND t."date" >= $2
    AND t."date" <= $3
  GROUP BY ${truncExpr}, ${labelExpr}
  ORDER BY ${truncExpr} ASC`;

const aggregationSchema = z
  .enum(["total", "average", "median"])
  .default("total");

const zeroBasedMonthBucketKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;

const monthBucketKeysBetween = (from: Date, to: Date): string[] => {
  const keys: string[] = [];
  let cursor = new Date(from.getFullYear(), from.getMonth(), 1);

  while (cursor <= to) {
    keys.push(zeroBasedMonthBucketKey(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return keys;
};

const median = (values: number[]): number => {
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid];

  if (upper === undefined) {
    return 0;
  }

  const lower = sorted[mid - 1];

  return lower !== undefined && sorted.length % 2 === 0
    ? Math.round((lower + upper) / 2)
    : upper;
};

const aggregateMonthly = <K>(
  monthly: Map<K, Map<string, number>>,
  months: string[],
  mode: "average" | "median"
): Map<K, number> => {
  const aggregated = new Map<K, number>();

  for (const [key, monthValues] of monthly) {
    const zeroFilledSeries = months.map((month) => monthValues.get(month) ?? 0);
    aggregated.set(
      key,
      mode === "average"
        ? Math.round(
            zeroFilledSeries.reduce((sum, value) => sum + value, 0) /
              months.length
          )
        : median(zeroFilledSeries)
    );
  }

  return aggregated;
};

const aggregateOutgoing = <T extends { amount: number; date: Date }, K>(
  transactions: T[],
  keyOf: (tx: T) => K,
  aggregation: "average" | "median" | "total",
  from: Date,
  to: Date
): Map<K, number> => {
  if (aggregation === "total") {
    const totals = new Map<K, number>();

    for (const tx of transactions) {
      const key = keyOf(tx);
      totals.set(key, (totals.get(key) ?? 0) + Math.abs(tx.amount));
    }

    return totals;
  }

  const monthsWithTransactions = new Set<string>();
  const monthly = new Map<K, Map<string, number>>();

  for (const tx of transactions) {
    const key = keyOf(tx);
    const month = zeroBasedMonthBucketKey(tx.date);
    monthsWithTransactions.add(month);
    let series = monthly.get(key);

    if (!series) {
      series = new Map();
      monthly.set(key, series);
    }

    series.set(month, (series.get(month) ?? 0) + Math.abs(tx.amount));
  }

  const activeMonths = monthBucketKeysBetween(from, to).filter((month) =>
    monthsWithTransactions.has(month)
  );

  return aggregateMonthly(monthly, activeMonths, aggregation);
};

const outgoingRows = (
  userId: string,
  from: Date,
  to: Date
): Promise<OutgoingRow[]> =>
  prisma.transaction.findMany({
    select: {
      amount: true,
      category: true,
      date: true,
      merchantKey: true,
      resolvedCategory: true,
    },
    where: {
      account: { connection: { userId } },
      amount: { lt: 0 },
      date: { gte: from, lte: to },
    },
  });

const outgoingByCategory = (
  rows: OutgoingRow[],
  aggregation: "average" | "median" | "total",
  from: Date,
  to: Date
): Map<SpendingCategory, number> =>
  aggregateOutgoing(rows, effectiveCategory, aggregation, from, to);

const recurringShareByCategory = (
  rows: OutgoingRow[],
  recurringKeys: Set<string>
): Map<SpendingCategory, number> => {
  const sums = new Map<SpendingCategory, { all: number; recurring: number }>();

  for (const row of rows) {
    const category = effectiveCategory(row);
    let categorySums = sums.get(category);

    if (!categorySums) {
      categorySums = { all: 0, recurring: 0 };
      sums.set(category, categorySums);
    }

    const amount = Math.abs(row.amount);
    categorySums.all += amount;

    if (row.merchantKey !== null && recurringKeys.has(row.merchantKey)) {
      categorySums.recurring += amount;
    }
  }

  const shares = new Map<SpendingCategory, number>();

  for (const [category, { all, recurring }] of sums) {
    shares.set(category, all > 0 ? recurring / all : 0);
  }

  return shares;
};

const userOutgoingByCategory = async (
  userId: string,
  aggregation: "average" | "median" | "total",
  from: Date,
  to: Date
): Promise<Map<SpendingCategory, number>> =>
  outgoingByCategory(
    await outgoingRows(userId, from, to),
    aggregation,
    from,
    to
  );

const outgoingBudgetLines = (lines: BudgetLineRow[]): PlannedLine[] =>
  lines.flatMap((line) => {
    const planned: PlannedLine = {
      amount: line.amount,
      categorySlug: line.categorySlug,
      parentSlug: line.category?.parentSlug ?? null,
    };

    return budgetLineKindOf(planned) === "OUTGOING" ? [planned] : [];
  });

const clearResolutions = ({
  connectionId,
  userId,
}: {
  connectionId?: string;
  userId: string;
}) =>
  prisma.transaction.updateMany({
    data: {
      resolutionConfidence: null,
      resolutionStage: null,
      resolvedCategory: null,
    },
    where: {
      account: {
        connection: connectionId ? { id: connectionId, userId } : { userId },
      },
      categoryOverride: false,
      isInternalTransfer: false,
    },
  });

class BudgetPipelineFailed extends Data.TaggedError("BudgetPipelineFailed")<{
  readonly cause: unknown;
  readonly reason: BudgetPipelineReason;
}> {}

const pipelineFailureMessage = (failure: BudgetPipelineFailed): string => {
  const causeMessage =
    failure.cause instanceof Error ? failure.cause.message : null;

  return Match.value(failure.reason).pipe(
    Match.discriminatorsExhaustive("kind")({
      categorisation: () =>
        causeMessage === null
          ? "Categorisation failed"
          : `Categorisation: ${causeMessage}`,
      "connection-sync": ({ institutionName }) =>
        `Connection ${institutionName}: ${causeMessage ?? "Unknown connection error"}`,
    })
  );
};

const writeResolutions = (
  resolutions: TransactionResolution[],
  reporter: SyncReporter
): Effect.Effect<number> =>
  Effect.forEach(
    resolutions,
    ({ data: fields, transactionId }) =>
      Effect.tryPromise(() =>
        prisma.transaction.update({
          data: fields,
          where: { id: transactionId },
        })
      ).pipe(
        Effect.match({ onFailure: () => 0, onSuccess: () => 1 }),
        Effect.tap(() => Effect.promise(() => reporter.categorised(1)))
      ),
    { concurrency: 1 }
  ).pipe(Effect.map((written) => written.reduce((sum, one) => sum + one, 0)));

const categoriseUncategorised = async (
  userId: string,
  reporter: SyncReporter
): Promise<number> => {
  const uncategorised = await prisma.transaction.findMany({
    select: {
      account: {
        select: {
          connection: {
            select: {
              institutionBic: true,
              institutionCountry: true,
            },
          },
        },
      },
      amount: true,
      bankTransactionCode: true,
      channel: true,
      counterpartyName: true,
      creditorAccountIban: true,
      currency: true,
      id: true,
      merchantCategoryCode: true,
      merchantKey: true,
      normalisedDescriptor: true,
      remittanceLines: true,
      transactionPath: true,
    },
    where: {
      account: { connection: { userId } },
      categoryOverride: false,
      isInternalTransfer: false,
      resolvedCategory: null,
    },
  });

  await reporter.categorisingStarted(uncategorised.length);

  if (uncategorised.length === 0) {
    return 0;
  }

  const inputs: (CategoriseInput & { txId: string })[] = [];

  for (const tx of uncategorised) {
    const merchantKey = tx.merchantKey ?? "";
    const isIban =
      tx.creditorAccountIban && merchantKey === tx.creditorAccountIban;

    // SAFETY: channel column stores validated TransactionChannel values or null
    const channel = (tx.channel ?? "unknown") as TransactionChannel;

    // SAFETY: transactionPath column stores validated TransactionPath values or null
    const path = (tx.transactionPath ??
      (isIban ? "iban" : "card")) as TransactionPath;

    inputs.push({
      amountMinor: tx.amount,
      bankTransactionCode: tx.bankTransactionCode,
      channel,
      counterpartyName: tx.counterpartyName,
      country: tx.account.connection.institutionCountry,
      creditorIban: tx.creditorAccountIban,
      currency: tx.currency,
      merchantCategoryCode: tx.merchantCategoryCode,
      merchantKey,
      normalisedDescriptor: tx.normalisedDescriptor ?? "",
      path,
      rawDescriptor: tx.remittanceLines.join(" "),
      txId: tx.id,
      userId,
    });
  }

  if (inputs.length === 0) {
    return 0;
  }

  const dictionaryCountries = [
    ...new Set(
      uncategorised.flatMap((tx) =>
        tx.account.connection.institutionCountry === null
          ? []
          : [tx.account.connection.institutionCountry]
      )
    ),
  ];

  const results = await categoriseBatch(inputs, {
    classifiers: transactionClassifiers,
    countries: dictionaryCountries,
    escalateBelow: classifierEscalateBelow,
    onSignatureSettled: reporter.heartbeat,
    store: prismaClassificationStore,
  });

  const resolutions = inputs.flatMap<TransactionResolution>((input, index) => {
    const categorised = results[index];

    if (!categorised?.category) {
      return [];
    }

    return [
      {
        data: {
          intermediaryName: categorised.intermediaryName,
          resolutionConfidence: categorised.confidence,
          resolutionStage: categorised.stage,
          resolvedCategory: categorised.category,
        },
        transactionId: input.txId,
      },
    ];
  });

  await reporter.categorised(inputs.length - resolutions.length);

  return await Effect.runPromise(writeResolutions(resolutions, reporter));
};

const calendarMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const trailingCalendarMonthKeys = (to: Date): string[] => {
  const keys: string[] = [];

  for (let back = RECURRING_MONTHS - 1; back >= 0; back -= 1) {
    keys.push(
      calendarMonthKey(new Date(to.getFullYear(), to.getMonth() - back, 1))
    );
  }

  return keys;
};

const zeroFilledMonths = (
  totals: RecurringMonthTotals[],
  keys: string[]
): RecurringMonthTotals[] => {
  const byMonth = new Map(totals.map((total) => [total.month, total]));

  return keys.map(
    (month) =>
      byMonth.get(month) ?? {
        behavioralMinor: 0,
        discretionaryMinor: 0,
        fixedMinor: 0,
        month,
      }
  );
};

const mostFrequentCurrency = (currencyCounts: Map<string, number>): string => {
  let currency = FALLBACK_CURRENCY;
  let bestCount = 0;

  for (const [code, count] of currencyCounts) {
    const tieBrokenByCode = count === bestCount && code < currency;

    if (count > bestCount || tieBrokenByCode) {
      currency = code;
      bestCount = count;
    }
  }

  return currency;
};

const accountsSummary = (
  accounts: { balanceMinor: number | null; currency: string | null }[]
): AccountsSummary => {
  let balance = 0;
  let valued = false;
  const currencyCounts = new Map<string, number>();

  for (const account of accounts) {
    if (account.balanceMinor !== null) {
      balance += account.balanceMinor;
      valued = true;
    }

    if (account.currency) {
      currencyCounts.set(
        account.currency,
        (currencyCounts.get(account.currency) ?? 0) + 1
      );
    }
  }

  return {
    availableBalanceMinor: valued ? balance : null,
    currency: mostFrequentCurrency(currencyCounts),
  };
};

const syncEveryConnection = (
  connections: Parameters<typeof syncConnection>[0][],
  errors: string[],
  userId: string,
  reporter: SyncReporter,
  force: boolean
): Effect.Effect<void> =>
  Effect.forEach(
    connections,
    (connection) =>
      Effect.tryPromise({
        catch: (cause) =>
          new BudgetPipelineFailed({
            cause,
            reason: {
              institutionName: connection.institutionName,
              kind: "connection-sync",
            },
          }),
        try: async () => {
          const providerUser = await findProviderUser(
            userId,
            getProvider(connection.provider)
          );

          await syncConnection(
            connection,
            errors,
            providerUser,
            reporter,
            force
          );
        },
      }).pipe(
        Effect.catchTag("BudgetPipelineFailed", (failure) => {
          errors.push(pipelineFailureMessage(failure));

          return Effect.void;
        })
      ),
    { concurrency: 1, discard: true }
  );

const categoriseAfterSync = (
  userId: string,
  connectionId: string | undefined,
  reporter: SyncReporter,
  force: boolean
): Effect.Effect<{ categorised: number; warning: string | undefined }> =>
  Effect.tryPromise({
    catch: (cause) =>
      new BudgetPipelineFailed({ cause, reason: { kind: "categorisation" } }),
    try: async () => {
      if (force) {
        await clearResolutions({ connectionId, userId });
      }

      return await categoriseUncategorised(userId, reporter);
    },
  }).pipe(
    Effect.map((categorised) => ({ categorised, warning: undefined })),
    Effect.catchTag("BudgetPipelineFailed", (failure) =>
      Effect.succeed({
        categorised: 0,
        warning: pipelineFailureMessage(failure),
      })
    )
  );

const runSyncAccounts = Effect.fnUntraced(function* runSyncAccounts(
  userId: string,
  connectionId: string | undefined,
  force: boolean,
  reporter: SyncReporter
) {
  const errors: string[] = [];
  const where: Prisma.BankConnectionWhereInput = { status: "ACTIVE", userId };

  if (connectionId) {
    where.id = connectionId;
  }

  const connections = yield* Effect.promise(() =>
    prisma.bankConnection.findMany({
      include: {
        accounts: {
          select: { id: true, providerAccountId: true, type: true },
        },
      },
      where,
    })
  );

  yield* syncEveryConnection(connections, errors, userId, reporter, force);
  yield* Effect.promise(() => matchInternalTransfers(userId));

  const { categorised, warning } = yield* categoriseAfterSync(
    userId,
    connectionId,
    reporter,
    force
  );

  return {
    categorised,
    error: errors.length > 0 ? errors.join("; ") : undefined,
    started: true,
    success: errors.length === 0,
    warning,
  };
});

export const budgetRouter = {
  getAccounts: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const accounts = await prisma.bankAccount.findMany({
      select: {
        connection: {
          select: { institutionName: true },
        },
        iban: true,
        id: true,
        name: true,
      },
      where: {
        connection: { userId },
      },
    });

    const transactionDateBounds = await prisma.transaction.aggregate({
      _max: { date: true },
      _min: { date: true },
      where: { account: { connection: { userId } } },
    });

    return {
      accounts: accounts.map((a) => ({
        iban: a.iban,
        id: a.id,
        institutionName: a.connection.institutionName,
        name: a.name,
      })),
      firstTransactionDate: transactionDateBounds._min.date,
      hasAccounts: accounts.length > 0,
      lastTransactionDate: transactionDateBounds._max.date,
    };
  }),

  getBudgetVsActual: protectedProcedure
    .input(
      z.object({
        aggregation: aggregationSchema,
        from: z.coerce.date(),
        to: z.coerce.date(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const { aggregation, from, to } = input;

      const [lines, actualByCategory] = await Promise.all([
        prisma.budgetLine.findMany({
          select: {
            amount: true,
            category: { select: { parentSlug: true } },
            categorySlug: true,
          },
          where: { userId },
        }),
        userOutgoingByCategory(userId, aggregation, from, to),
      ]);

      const outgoings = outgoingBudgetLines(lines);
      const planScaleMonths =
        aggregation === "total" ? periodMonthCount(from, to, new Date()) : 1;

      const planned = plannedByCategory(outgoings, planScaleMonths);
      const categories = SPENDING_CATEGORIES.flatMap((category) => {
        const row = {
          actual: actualByCategory.get(category) ?? 0,
          category,
          planned: planned.get(category) ?? 0,
        };

        return row.planned > 0 || row.actual > 0 ? [row] : [];
      }).toSorted((a, b) => b.planned - a.planned || b.actual - a.actual);

      return {
        categories,
        hasPlan: outgoings.length > 0,
      };
    }),

  getCashFlow: protectedProcedure
    .input(
      z.object({
        from: z.coerce.date(),
        to: z.coerce.date(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const { from, to } = input;

      const spanDays = Math.ceil(
        (to.getTime() - from.getTime()) / MILLISECONDS_PER_DAY
      );

      const sql = cashFlowQuery(cashFlowGrainFor(spanDays));

      const periods = await prisma.$queryRawUnsafe<
        { incoming: bigint; label: string; outgoing: bigint }[]
      >(sql, userId, from, to);

      return {
        periods: periods.map((p) => ({
          incoming: Number(p.incoming),
          label: p.label,
          outgoing: Number(p.outgoing),
        })),
      };
    }),

  getFixedVsVariable: protectedProcedure
    .input(
      z.object({
        aggregation: aggregationSchema,
        from: z.coerce.date(),
        to: z.coerce.date(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const { aggregation, from, to } = input;

      const [rows, recurring] = await Promise.all([
        outgoingRows(userId, from, to),
        detectRecurringExpenses(userId, cadenceWindow(from, to)),
      ]);

      const byCategory = outgoingByCategory(rows, aggregation, from, to);
      const recurringShare = recurringShareByCategory(
        rows,
        new Set(recurring.map((e) => e.merchantKey))
      );

      let fixed = 0;
      let total = 0;

      for (const [category, amount] of byCategory) {
        fixed += Math.round(amount * (recurringShare.get(category) ?? 0));
        total += amount;
      }

      return { fixed, variable: total - fixed };
    }),

  getMerchants: protectedProcedure
    .input(
      z.object({
        direction: z.enum(["incoming", "outgoing"]).optional(),
        from: z.coerce.date(),
        limit: z.number().int().min(1).max(100).default(30),
        search: z.string().optional(),
        to: z.coerce.date(),
      })
    )
    .handler(async ({ context, input }) => {
      const { direction, from, limit, search, to } = input;
      const signPredicate = direction ? AMOUNT_SIGN_PREDICATE[direction] : "";
      const sql = `SELECT
          MIN(COALESCE(t."counterpartyName", initcap(t."normalisedDescriptor"))) AS name,
          COUNT(*)::bigint AS count,
          SUM(ABS(t."amount"))::bigint AS total
        FROM "transaction" t
        JOIN "bank_account" ba ON ba."id" = t."accountId"
        JOIN "bank_connection" bc ON bc."id" = ba."connectionId"
        WHERE bc."userId" = $1
          AND t."date" >= $2
          AND t."date" <= $3
          AND COALESCE(t."counterpartyName", t."normalisedDescriptor") <> ''
          AND ($4::text IS NULL OR COALESCE(t."counterpartyName", t."normalisedDescriptor") ILIKE '%' || $4 || '%')
          ${signPredicate}
        GROUP BY lower(COALESCE(t."counterpartyName", t."normalisedDescriptor"))
        ORDER BY count DESC, name ASC
        LIMIT $5`;

      const rows = await prisma.$queryRawUnsafe<
        { count: bigint; name: string; total: bigint }[]
      >(sql, context.session.user.id, from, to, search ?? null, limit);

      return {
        merchants: rows.map((row) => ({
          count: Number(row.count),
          name: row.name,
          totalMinor: Number(row.total),
        })),
      };
    }),

  getRecurring: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const asOf = new Date();
    const observed = trailingYear(asOf);

    const [detected, lines, incoming, accounts] = await Promise.all([
      detectRecurring(userId, observed),
      prisma.budgetLine.findMany({
        select: {
          amount: true,
          category: { select: { parentSlug: true } },
          categorySlug: true,
        },
        where: { userId },
      }),
      prisma.transaction.aggregate({
        _min: { date: true },
        _sum: { amount: true },
        where: {
          account: { connection: { userId } },
          amount: { gt: 0 },
          date: { gte: observed.from, lte: observed.to },
          isInternalTransfer: false,
        },
      }),
      prisma.bankAccount.findMany({
        select: { balanceMinor: true, currency: true },
        where: { connection: { userId } },
      }),
    ]);

    const outgoingLines = outgoingBudgetLines(lines);
    const plannedOutgoingMinor =
      outgoingLines.length > 0
        ? outgoingLines.reduce((sum, line) => sum + line.amount, 0)
        : null;

    const incomingTotal = incoming._sum.amount;
    const firstIncoming = incoming._min.date;
    const monthsCarryingIncome =
      firstIncoming === null ? null : monthSpan(firstIncoming, observed.to);

    const monthlyIncomeMinor =
      incomingTotal === null || monthsCarryingIncome === null
        ? null
        : Math.round(incomingTotal / monthsCarryingIncome);

    const { availableBalanceMinor, currency } = accountsSummary(accounts);

    return {
      asOf: asOf.toISOString(),
      availableBalanceMinor,
      currency,
      items: detected.expenses.map((expense) => ({
        amountSpread: expense.amountSpread,
        category: expense.category,
        confidence: expense.confidence,
        currency: expense.currency,
        frequency: expense.frequency,
        intervalDays: expense.intervalDays,
        kind: expense.kind,
        lastSeen: expense.lastSeen.toISOString(),
        merchantKey: expense.merchantKey,
        merchantName: expense.merchantName,
        nextExpected: expense.nextExpected.toISOString(),
        occurrences: expense.occurrences,
        typicalAmountMinor: expense.typicalAmountMinor,
      })),
      monthly: zeroFilledMonths(
        detected.months,
        trailingCalendarMonthKeys(asOf)
      ),
      monthlyIncomeMinor,
      plannedOutgoingMinor,
    };
  }),

  getRecurringExpenses: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const expenses = await detectRecurringExpenses(userId, trailingYear());

    return {
      expenses: expenses.map((e) => ({
        category: e.category,
        currency: e.currency,
        frequency: e.frequency,
        intervalDays: e.intervalDays,
        lastSeen: e.lastSeen.toISOString(),
        merchantKey: e.merchantKey,
        merchantName: e.merchantName,
        nextExpected: e.nextExpected.toISOString(),
        occurrences: e.occurrences,
        typicalAmountMinor: e.typicalAmountMinor,
      })),
    };
  }),

  getSankeyData: protectedProcedure
    .input(
      z.object({
        aggregation: aggregationSchema,
        from: z.coerce.date(),
        to: z.coerce.date(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const { aggregation, from, to } = input;

      const transactions = await prisma.transaction.findMany({
        select: {
          amount: true,
          category: true,
          counterpartyName: true,
          date: true,
          resolvedCategory: true,
        },
        where: {
          account: { connection: { userId } },
          date: { gte: from, lte: to },
        },
      });

      let incomeSources: Map<string, number>;
      let expenseCategories: Map<SpendingCategory, number>;

      if (aggregation === "total") {
        incomeSources = new Map();
        expenseCategories = new Map();

        for (const tx of transactions) {
          if (tx.amount > 0) {
            const source = tx.counterpartyName ?? OTHER_INCOME_LABEL;
            incomeSources.set(
              source,
              (incomeSources.get(source) ?? 0) + tx.amount
            );
          } else {
            const category = effectiveCategory(tx);
            const abs = Math.abs(tx.amount);
            expenseCategories.set(
              category,
              (expenseCategories.get(category) ?? 0) + abs
            );
          }
        }
      } else {
        const monthsWithTransactions = new Set<string>();
        const monthlyIncome = new Map<string, Map<string, number>>();
        const monthlyExpense = new Map<SpendingCategory, Map<string, number>>();

        for (const tx of transactions) {
          const month = zeroBasedMonthBucketKey(tx.date);
          monthsWithTransactions.add(month);

          if (tx.amount > 0) {
            const source = tx.counterpartyName ?? OTHER_INCOME_LABEL;
            let srcMonths = monthlyIncome.get(source);

            if (!srcMonths) {
              srcMonths = new Map();
              monthlyIncome.set(source, srcMonths);
            }

            srcMonths.set(month, (srcMonths.get(month) ?? 0) + tx.amount);
          } else {
            const category = effectiveCategory(tx);
            const abs = Math.abs(tx.amount);
            let catMonths = monthlyExpense.get(category);

            if (!catMonths) {
              catMonths = new Map();
              monthlyExpense.set(category, catMonths);
            }

            catMonths.set(month, (catMonths.get(month) ?? 0) + abs);
          }
        }

        const activeMonths = monthBucketKeysBetween(from, to).filter((month) =>
          monthsWithTransactions.has(month)
        );

        incomeSources = aggregateMonthly(
          monthlyIncome,
          activeMonths,
          aggregation
        );

        expenseCategories = aggregateMonthly(
          monthlyExpense,
          activeMonths,
          aggregation
        );
      }

      const incomeByDescendingValue = [...incomeSources.entries()].toSorted(
        (a, b) => b[1] - a[1]
      );

      const incomeNodes = incomeByDescendingValue
        .slice(0, TOP_INCOME_SOURCES)
        .map(([name, value]) => ({ name, value }));

      const incomeBeyondTopSources = incomeByDescendingValue
        .slice(TOP_INCOME_SOURCES)
        .reduce((sum, [, value]) => sum + value, 0);

      if (incomeBeyondTopSources > 0) {
        const existing = incomeNodes.find((n) => n.name === OTHER_INCOME_LABEL);

        if (existing) {
          existing.value += incomeBeyondTopSources;
        } else {
          incomeNodes.push({
            name: OTHER_INCOME_LABEL,
            value: incomeBeyondTopSources,
          });
        }
      }

      const byGroup = new Map<
        CategoryGroup,
        { category: SpendingCategory; value: number }[]
      >();

      for (const [category, value] of expenseCategories) {
        if (value <= 0) {
          continue;
        }

        const group = CATEGORY_GROUP_OF[category];
        const leaves = byGroup.get(group);
        const leaf = { category, value };

        if (leaves) {
          leaves.push(leaf);
        } else {
          byGroup.set(group, [leaf]);
        }
      }

      const groups = CATEGORY_GROUPS.flatMap((group) => {
        const leaves = byGroup.get(group);

        if (!leaves) {
          return [];
        }

        const categories = leaves.toSorted((a, b) => b.value - a.value);

        return [
          {
            categories,
            group,
            value: categories.reduce((sum, leaf) => sum + leaf.value, 0),
          },
        ];
      });

      const totalIncome = incomeNodes.reduce((s, n) => s + n.value, 0);
      const totalExpenses = groups.reduce((s, g) => s + g.value, 0);

      return {
        groups,
        incomeNodes,
        moneyLeft: Math.max(0, totalIncome - totalExpenses),
        totalExpenses,
        totalIncome,
      };
    }),

  getSpendingBreakdown: protectedProcedure
    .input(
      z.object({
        aggregation: aggregationSchema,
        from: z.coerce.date(),
        to: z.coerce.date(),
      })
    )
    .handler(async ({ context, input }) => {
      const categoryAmounts = await userOutgoingByCategory(
        context.session.user.id,
        input.aggregation,
        input.from,
        input.to
      );

      const categories = [...categoryAmounts.entries()]
        .map(([category, amount]) => ({
          amount,
          category,
        }))
        .toSorted((a, b) => b.amount - a.amount);

      return { categories };
    }),

  getSyncStatus: protectedProcedure.handler(({ context }) =>
    readSyncProgress(context.session.user.id)
  ),

  getTransactions: protectedProcedure
    .input(
      z.object({
        amountMax: z.number().int().min(0).optional(),
        amountMin: z.number().int().min(0).optional(),
        categories: z.array(z.enum(SPENDING_CATEGORIES)).optional(),
        cursor: z.string().optional(),
        direction: z.enum(["incoming", "outgoing"]).optional(),
        from: z.coerce.date(),
        groups: z.array(z.enum(CATEGORY_GROUPS)).optional(),
        limit: z.number().min(1).max(100).default(50),
        merchants: z.array(z.string().min(1)).optional(),
        search: z.string().optional(),
        sort: z.enum(["date", "amount"]).default("date"),
        to: z.coerce.date(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const {
        amountMax,
        amountMin,
        categories,
        cursor,
        direction,
        from,
        groups,
        limit,
        merchants,
        search,
        sort,
        to,
      } = input;

      const dateFilter = { gte: from, lte: to };
      let directionFilter: { gt: number } | { lt: number } | undefined;

      if (direction === "incoming") {
        directionFilter = { gt: 0 };
      } else if (direction === "outgoing") {
        directionFilter = { lt: 0 };
      }

      const conditions: Prisma.TransactionWhereInput[] = [];

      if (search) {
        conditions.push({
          OR: [
            {
              description: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              counterpartyName: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          ],
        });
      }

      const amountBounds = amountBoundsCondition({
        maximumAbsoluteMinorUnits: amountMax,
        minimumAbsoluteMinorUnits: amountMin,
      });

      if (amountBounds) {
        conditions.push(amountBounds);
      }

      if (merchants && merchants.length > 0) {
        const caseFoldedMerchantMatches = merchants.flatMap((name) => [
          {
            counterpartyName: { equals: name, mode: "insensitive" as const },
          },
          {
            counterpartyName: null,
            normalisedDescriptor: {
              equals: name,
              mode: "insensitive" as const,
            },
          },
        ]);

        conditions.push({ OR: caseFoldedMerchantMatches });
      }

      const selected = new Set<SpendingCategory>(categories);

      for (const group of groups ?? []) {
        for (const category of categoriesInGroup(group)) {
          selected.add(category);
        }
      }

      if (selected.size > 0) {
        const wanted = [...selected];
        conditions.push({
          OR: [
            { category: { in: wanted } },
            { category: null, resolvedCategory: { in: wanted } },
          ],
        });
      }

      const baseWhere: Prisma.TransactionWhereInput = {
        account: { connection: { userId } },
        amount: directionFilter,
        date: dateFilter,
      };

      if (conditions.length > 0) {
        baseWhere.AND = conditions;
      }

      const largestAmountFirst = direction === "incoming" ? "desc" : "asc";
      const findManyOpts: Prisma.TransactionFindManyArgs = {
        orderBy:
          sort === "amount"
            ? [{ amount: largestAmountFirst }, { id: "desc" }]
            : [{ date: "desc" }, { id: "desc" }],
        select: {
          amount: true,
          category: true,
          counterpartyName: true,
          currency: true,
          date: true,
          description: true,
          id: true,
          resolvedCategory: true,
        },
        take: limit + 1,
        where: baseWhere,
      };

      if (cursor) {
        findManyOpts.cursor = { id: cursor };
        findManyOpts.skip = 1;
      }

      const [transactions, incomingTotal, outgoingTotal] = await Promise.all([
        prisma.transaction.findMany(findManyOpts),
        prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { ...baseWhere, amount: { gt: 0 } },
        }),
        prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { ...baseWhere, amount: { lt: 0 } },
        }),
      ]);

      let nextCursor: string | null = null;

      if (transactions.length > limit) {
        const last = transactions.pop();
        nextCursor = last?.id ?? null;
      }

      return {
        nextCursor,
        totals: {
          incoming: incomingTotal._sum.amount ?? 0,
          outgoing: Math.abs(outgoingTotal._sum.amount ?? 0),
        },
        transactions: transactions.map((t) => ({
          amount: t.amount,
          category: effectiveCategory(t),
          counterpartyName: t.counterpartyName,
          currency: t.currency,
          date: t.date.toISOString(),
          derivedCategory: pipelineCategory(t),
          description: t.description,
          id: t.id,
        })),
      };
    }),

  recategorise: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const claimedAt = await claimSyncRun(userId, "CATEGORISING");

    if (claimedAt === null) {
      return { categorised: 0, started: false };
    }

    const reporter = createSyncReporter(userId, "CATEGORISING", claimedAt);
    const categorised = await Effect.runPromise(
      Effect.promise(async () => {
        await clearResolutions({ userId });

        return await categoriseUncategorised(userId, reporter);
      }).pipe(Effect.ensuring(Effect.promise(() => reporter.finished())))
    );

    return { categorised, started: true };
  }),

  syncAccounts: protectedProcedure
    .input(
      z
        .object({
          connectionId: z.string().optional(),
          force: z.boolean().optional(),
        })
        .optional()
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const claimedAt = await claimSyncRun(userId, "IMPORTING");

      if (claimedAt === null) {
        return {
          categorised: 0,
          error: undefined,
          started: false,
          success: true,
          warning: undefined,
        };
      }

      const reporter = createSyncReporter(userId, "IMPORTING", claimedAt);

      return await Effect.runPromise(
        runSyncAccounts(
          userId,
          input?.connectionId,
          input?.force ?? false,
          reporter
        ).pipe(Effect.ensuring(Effect.promise(() => reporter.finished())))
      );
    }),

  updateTransactionCategory: protectedProcedure
    .input(
      z.object({
        category: z.enum(SPENDING_CATEGORIES).nullable(),
        transactionId: z.string(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const tx = await prisma.transaction.findFirst({
        select: {
          category: true,
          counterpartyName: true,
          id: true,
          merchantKey: true,
          resolvedCategory: true,
        },
        where: {
          account: { connection: { userId } },
          id: input.transactionId,
        },
      });

      if (!tx) {
        throw new ORPCError("NOT_FOUND", {
          message: "Transaction not found",
        });
      }

      const additionalUpdated = await prisma.$transaction(async (db) => {
        await db.transaction.update({
          data: {
            category: input.category,
            categoryOverride: input.category !== null,
          },
          where: { id: input.transactionId },
        });

        if (!tx.merchantKey) {
          return 0;
        }

        if (input.category === null) {
          await deleteUserOverride(userId, tx.merchantKey, db);

          const siblingsCleared = await db.transaction.updateMany({
            data: { category: null },
            where: {
              account: { connection: { userId } },
              categoryOverride: false,
              id: { not: input.transactionId },
              merchantKey: tx.merchantKey,
            },
          });

          return siblingsCleared.count;
        }

        await upsertUserOverride(
          userId,
          tx.merchantKey,
          input.category,
          tx.counterpartyName,
          db
        );

        const siblingsPropagated = await db.transaction.updateMany({
          data: { category: input.category },
          where: {
            account: { connection: { userId } },
            categoryOverride: false,
            id: { not: input.transactionId },
            merchantKey: tx.merchantKey,
          },
        });

        return siblingsPropagated.count;
      });

      const updated = await prisma.transaction.findUniqueOrThrow({
        select: {
          category: true,
          resolvedCategory: true,
        },
        where: { id: input.transactionId },
      });

      return {
        additionalUpdated,
        category: effectiveCategory(updated),
        derivedCategory: pipelineCategory(updated),
      };
    }),
};
