import { Data, Effect, Match, Schema } from "effect";

import type { SpendingCategory } from "../../../lib/taxonomy";
import { ACCEPT_CONFIDENCE, concentration } from "../confidence";
import { endpointHeaders, unreachableDetail } from "../endpoint";
import {
  CATEGORY_CRITERIA,
  isOfferedCategory,
  offeredCategories,
} from "../questions";
import type {
  ClassificationInput,
  ClassificationPrediction,
  ClassifierTransport,
  TransactionClassifier,
  TransactionDirection,
} from "../types";

export interface ZeroShotSettings {
  apiKey: string | undefined;
  model: string;
  temperature: number;
  timeoutMs: number;
  url: string;
}

type ZeroShotClassificationReason =
  | { readonly kind: "unreachable"; readonly detail: string }
  | {
      readonly kind: "rejected";
      readonly status: number;
      readonly body: string;
    }
  | { readonly kind: "undecodable"; readonly detail: string }
  | { readonly kind: "unoffered-label"; readonly value: string };

interface ScoredLabels {
  readonly labels: readonly string[];
  readonly scores: readonly number[];
}

export class ZeroShotClassificationFailed extends Data.TaggedError(
  "ZeroShotClassificationFailed"
)<{
  readonly reason: ZeroShotClassificationReason;
}> {
  override get message(): string {
    return Match.value(this.reason).pipe(
      Match.discriminatorsExhaustive("kind")({
        rejected: ({ body, status }) =>
          `the endpoint refused the classification: ${status} ${body}`,
        undecodable: ({ detail }) =>
          `the endpoint answered outside the documented shape: ${detail}`,
        "unoffered-label": ({ value }) =>
          `the endpoint answered with a label this transaction cannot take: ${value}`,
        unreachable: ({ detail }) => `the endpoint is unreachable: ${detail}`,
      })
    );
  }
}

const HYPOTHESIS_TEMPLATE = "This bank transaction is: {}.";
const STATE_SEPARATOR = " | ";

const CANDIDATE_RUBRICS = {
  credit: offeredCategories("credit").map(
    (category) => CATEGORY_CRITERIA[category]
  ),
  debit: offeredCategories("debit").map(
    (category) => CATEGORY_CRITERIA[category]
  ),
} as const satisfies Record<TransactionDirection, readonly string[]>;

const CATEGORY_OF_RUBRIC = {
  credit: Object.fromEntries(
    offeredCategories("credit").map((category) => [
      CATEGORY_CRITERIA[category],
      category,
    ])
  ),
  debit: Object.fromEntries(
    offeredCategories("debit").map((category) => [
      CATEGORY_CRITERIA[category],
      category,
    ])
  ),
} as const satisfies Record<
  TransactionDirection,
  Record<string, SpendingCategory>
>;

const ScoredLabelsSchema = Schema.Struct({
  labels: Schema.Array(Schema.String),
  scores: Schema.Array(Schema.Number),
});

const ScoredLabelSchema = Schema.Struct({
  label: Schema.String,
  score: Schema.Number,
});

const ZeroShotResponseSchema = Schema.Union([
  ScoredLabelsSchema,
  Schema.Array(ScoredLabelSchema),
]);

type ZeroShotResponse = typeof ZeroShotResponseSchema.Type;

type ScoredLabel = typeof ScoredLabelSchema.Type;

const isScoredLabelList = (
  decoded: ZeroShotResponse
): decoded is readonly ScoredLabel[] => Array.isArray(decoded);

const readResponse = Effect.fnUntraced(function* readResponse(
  settings: ZeroShotSettings,
  transport: ClassifierTransport,
  input: ClassificationInput
) {
  const response = yield* Effect.tryPromise({
    catch: (cause) =>
      new ZeroShotClassificationFailed({
        reason: {
          detail: unreachableDetail(cause, settings.timeoutMs),
          kind: "unreachable",
        },
      }),
    try: () =>
      transport(settings.url, {
        body: JSON.stringify({
          inputs: [
            input.normalisedDescriptor,
            input.counterpartyName,
            input.merchantCategoryCode,
            input.channel,
            input.amountBucket,
            input.currency,
            input.country,
          ]
            .filter((part): part is string => part !== null && part !== "")
            .join(STATE_SEPARATOR),
          parameters: {
            candidate_labels: CANDIDATE_RUBRICS[input.direction],
            hypothesis_template: HYPOTHESIS_TEMPLATE,
            multi_label: false,
          },
        }),
        headers: endpointHeaders(settings.apiKey),
        method: "POST",
        signal: AbortSignal.timeout(settings.timeoutMs),
      }),
  });

  if (!response.ok) {
    const body = yield* Effect.tryPromise({
      catch: (cause) =>
        new ZeroShotClassificationFailed({
          reason: {
            detail: unreachableDetail(cause, settings.timeoutMs),
            kind: "unreachable",
          },
        }),
      try: () => response.text(),
    });

    return yield* new ZeroShotClassificationFailed({
      reason: { body, kind: "rejected", status: response.status },
    });
  }

  const payload = yield* Effect.tryPromise({
    catch: (cause) =>
      new ZeroShotClassificationFailed({
        reason: { detail: String(cause), kind: "undecodable" },
      }),
    try: () => response.json(),
  });

  return yield* Schema.decodeUnknownEffect(ZeroShotResponseSchema)(
    payload
  ).pipe(
    Effect.mapError(
      (cause: Schema.SchemaError) =>
        new ZeroShotClassificationFailed({
          reason: { detail: cause.message, kind: "undecodable" },
        })
    )
  );
});

const readPrediction = Effect.fnUntraced(function* readPrediction(
  decoded: ZeroShotResponse,
  settings: ZeroShotSettings,
  direction: TransactionDirection
) {
  const scored: ScoredLabels = isScoredLabelList(decoded)
    ? {
        labels: decoded.map((entry) => entry.label),
        scores: decoded.map((entry) => entry.score),
      }
    : decoded;

  if (
    scored.labels.length === 0 ||
    scored.labels.length !== scored.scores.length
  ) {
    return yield* new ZeroShotClassificationFailed({
      reason: {
        detail: `${scored.labels.length} labels against ${scored.scores.length} scores`,
        kind: "undecodable",
      },
    });
  }

  let pickedLabel = "";
  let pickedScore = Number.NEGATIVE_INFINITY;

  for (const [index, label] of scored.labels.entries()) {
    const score = scored.scores[index] ?? Number.NEGATIVE_INFINITY;

    if (score > pickedScore) {
      pickedLabel = label;
      pickedScore = score;
    }
  }

  const category = CATEGORY_OF_RUBRIC[direction][pickedLabel];

  if (!(category && isOfferedCategory(category, direction))) {
    return yield* new ZeroShotClassificationFailed({
      reason: { kind: "unoffered-label", value: pickedLabel },
    });
  }

  if (category === "uncategorised") {
    return null;
  }

  const confidence = concentration(
    scored.scores,
    offeredCategories(direction).length,
    settings.temperature
  );

  if (confidence < ACCEPT_CONFIDENCE) {
    return null;
  }

  return {
    answeredBy: settings.model,
    category,
    confidence,
  };
});

const classifyWith = (
  settings: ZeroShotSettings,
  transport: ClassifierTransport,
  input: ClassificationInput
): Promise<ClassificationPrediction | null> =>
  Effect.runPromise(
    readResponse(settings, transport, input).pipe(
      Effect.flatMap((decoded) =>
        readPrediction(decoded, settings, input.direction)
      ),
      Effect.mapError(
        (failure: ZeroShotClassificationFailed) => new Error(failure.message)
      )
    )
  );

export const createZeroShotClassifier = (
  settings: ZeroShotSettings,
  transport: ClassifierTransport = fetch
): TransactionClassifier => ({
  classify: (input) => classifyWith(settings, transport, input),
  model: settings.model,
  provider: "zero-shot",
});
