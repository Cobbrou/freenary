import prisma from "@freenary/db";
import { Effect } from "effect";

import { REFERENCE_CURRENCY } from "../fx/rate-book";
import { loadRateBook } from "../fx/rates";
import {
  BudgetPipelineFailed,
  claimSyncRun,
  createSyncReporter,
  reportPipelineFailure,
} from "../lib/sync-progress";
import type { BudgetPipelineReason, SyncReporter } from "../lib/sync-progress";
import {
  lowConfidenceTransactionIds,
  notifyTransactionsToCheck,
} from "../notifications/transactions-to-check";
import {
  classifierCallBudget,
  classifierEscalateBelow,
  transactionClassifiers,
} from "./classifier/registry";
import { prismaClassificationStore } from "./classifier/store";
import type { TransactionChannel } from "./normalise/types";
import { categoriseBatch } from "./resolve";
import type { CategoriseInput, TransactionPath } from "./types";

interface TransactionResolution {
  data: {
    intermediaryName: string | null;
    resolutionConfidence: number | null;
    resolutionStage: string | null;
    resolvedCategory: string;
  };
  transactionId: string;
}

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

const writeResolutions = (
  resolutions: TransactionResolution[],
  reporter: SyncReporter
): Effect.Effect<number> => {
  const byFields = new Map<
    string,
    { fields: TransactionResolution["data"]; ids: string[] }
  >();

  for (const { data: fields, transactionId } of resolutions) {
    const key = JSON.stringify(fields);
    const group = byFields.get(key) ?? { fields, ids: [] };

    group.ids.push(transactionId);
    byFields.set(key, group);
  }

  return Effect.forEach(
    [...byFields.values()],
    ({ fields, ids }) =>
      Effect.tryPromise(() =>
        prisma.transaction.updateMany({
          data: fields,
          where: { id: { in: ids } },
        })
      ).pipe(
        Effect.matchEffect({
          onFailure: (cause) =>
            Effect.logWarning(
              "Writing transaction resolutions failed",
              ids.length,
              cause
            ).pipe(Effect.as(0)),
          onSuccess: ({ count }) => Effect.succeed(count),
        }),
        Effect.tap(() => Effect.promise(() => reporter.categorised(ids.length)))
      ),
    { concurrency: 1 }
  ).pipe(Effect.map((written) => written.reduce((sum, one) => sum + one, 0)));
};

const raiseTransactionsToCheck = (
  userId: string,
  transactionIds: readonly string[]
): Effect.Effect<void> =>
  Effect.tryPromise(() =>
    notifyTransactionsToCheck(userId, transactionIds)
  ).pipe(
    Effect.matchEffect({
      onFailure: (cause) =>
        Effect.logWarning(
          "Raising the transactions to check notification failed",
          transactionIds.length,
          cause
        ),
      onSuccess: () => Effect.void,
    })
  );

const categoriseUncategorised = async (
  userId: string,
  reporter: SyncReporter,
  askedForByUser: boolean
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
      date: true,
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
  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;

  for (const tx of uncategorised) {
    earliest = Math.min(earliest, tx.date.getTime());
    latest = Math.max(latest, tx.date.getTime());
  }

  const rates = await loadRateBook(
    [...new Set(uncategorised.map((tx) => tx.currency))],
    new Date(earliest),
    new Date(latest)
  );

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
      referenceAmountMinor: rates.convert(
        tx.amount,
        tx.currency,
        REFERENCE_CURRENCY,
        tx.date
      ),
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
    askedForByUser,
    classifiers: transactionClassifiers,
    countries: dictionaryCountries,
    escalateBelow: classifierEscalateBelow,
    onSignatureSettled: reporter.heartbeat,
    store: prismaClassificationStore,
    timeoutMs: classifierCallBudget,
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

  const written = await Effect.runPromise(
    writeResolutions(resolutions, reporter)
  );

  await Effect.runPromise(
    raiseTransactionsToCheck(
      userId,
      lowConfidenceTransactionIds(
        uncategorised.map((tx) => ({ date: tx.date, id: tx.id })),
        results
      )
    )
  );

  return written;
};

export const categoriseAfterSync = (
  userId: string,
  connectionId: string | undefined,
  reporter: SyncReporter,
  force: boolean
): Effect.Effect<{
  categorised: number;
  failure: BudgetPipelineReason | undefined;
}> =>
  Effect.tryPromise({
    catch: (cause) =>
      new BudgetPipelineFailed({ cause, reason: { kind: "categorisation" } }),
    try: async () => {
      if (force) {
        await clearResolutions({ connectionId, userId });
      }

      return await categoriseUncategorised(userId, reporter, force);
    },
  }).pipe(
    Effect.map((categorised) => ({ categorised, failure: undefined })),
    Effect.catchTag("BudgetPipelineFailed", (failure) =>
      reportPipelineFailure(failure).pipe(
        Effect.map((reason) => ({ categorised: 0, failure: reason }))
      )
    )
  );

export const startRecategorisation = async (
  userId: string
): Promise<Date | null> => {
  const claimedAt = await claimSyncRun(userId, "CATEGORISING");

  if (claimedAt === null) {
    return null;
  }

  const reporter = createSyncReporter(userId, "CATEGORISING", claimedAt);

  Effect.runFork(
    categoriseAfterSync(userId, undefined, reporter, true).pipe(
      Effect.tapCause(Effect.logError),
      Effect.matchCauseEffect({
        onFailure: () => Effect.promise(() => reporter.finished()),
        onSuccess: ({ categorised, failure }) =>
          Effect.promise(() =>
            reporter.finishedWith({
              categorised,
              failures: failure ? [failure] : [],
            })
          ),
      })
    )
  );

  return claimedAt;
};
