import { Data, Effect, Match, Schema } from "effect";

import type { SpendingCategory } from "../../../lib/taxonomy";
import { concentration, NEUTRAL_TEMPERATURE } from "../confidence";
import { endpointHeaders, unreachableDetail } from "../endpoint";
import {
  assignableCategories,
  CATEGORY_QUESTION_ID,
  isAssignableCategory,
  QUESTIONS_BY_DIRECTION,
} from "../questions";
import type {
  ClassificationInput,
  ClassificationPrediction,
  ClassifierTransport,
  TransactionClassifier,
} from "../types";

export interface SystemOneSettings {
  apiKey: string | undefined;
  model: string;
  temperature: number;
  timeoutMs: number;
  url: string;
}

type SystemOneReason =
  | { readonly kind: "unreachable"; readonly detail: string }
  | {
      readonly kind: "rejected";
      readonly status: number;
      readonly body: string;
    }
  | { readonly kind: "undecodable"; readonly detail: string }
  | { readonly kind: "unoffered-category"; readonly value: string };

export class SystemOneClassificationFailed extends Data.TaggedError(
  "SystemOneClassificationFailed"
)<{
  readonly reason: SystemOneReason;
}> {
  override get message(): string {
    return Match.value(this.reason).pipe(
      Match.discriminatorsExhaustive("kind")({
        rejected: ({ body, status }) =>
          `the endpoint refused the classification: ${status} ${body}`,
        undecodable: ({ detail }) =>
          `the endpoint answered outside the documented shape: ${detail}`,
        "unoffered-category": ({ value }) =>
          `the endpoint answered with a category this transaction cannot take: ${value}`,
        unreachable: ({ detail }) => `the endpoint is unreachable: ${detail}`,
      })
    );
  }
}

const SYSTEM_ONE_PROVIDER = "system-one";

const ChoiceAnswerSchema = Schema.Struct({
  certainty: Schema.optional(Schema.Number),
  choice: Schema.String,
  confidence: Schema.Number,
  probabilities: Schema.optional(Schema.Record(Schema.String, Schema.Number)),
});

const SystemOneResponseSchema = Schema.Struct({
  answers: Schema.Record(Schema.String, ChoiceAnswerSchema),
  model: Schema.String,
});

type SystemOneResponse = typeof SystemOneResponseSchema.Type;

const readAnswers = Effect.fnUntraced(function* readAnswers(
  settings: SystemOneSettings,
  transport: ClassifierTransport,
  input: ClassificationInput
) {
  const response = yield* Effect.tryPromise({
    catch: (cause) =>
      new SystemOneClassificationFailed({
        reason: {
          detail: unreachableDetail(cause, settings.timeoutMs),
          kind: "unreachable",
        },
      }),
    try: () =>
      transport(settings.url, {
        body: JSON.stringify({
          model: settings.model,
          questions: QUESTIONS_BY_DIRECTION[input.direction],
          state: input,
        }),
        headers: endpointHeaders(settings.apiKey),
        method: "POST",
        signal: AbortSignal.timeout(settings.timeoutMs),
      }),
  });

  if (!response.ok) {
    const body = yield* Effect.tryPromise({
      catch: (cause) =>
        new SystemOneClassificationFailed({
          reason: {
            detail: unreachableDetail(cause, settings.timeoutMs),
            kind: "unreachable",
          },
        }),
      try: () => response.text(),
    });

    return yield* new SystemOneClassificationFailed({
      reason: { body, kind: "rejected", status: response.status },
    });
  }

  const payload = yield* Effect.tryPromise({
    catch: (cause) =>
      new SystemOneClassificationFailed({
        reason: { detail: String(cause), kind: "undecodable" },
      }),
    try: () => response.json(),
  });

  return yield* Schema.decodeUnknownEffect(SystemOneResponseSchema)(
    payload
  ).pipe(
    Effect.mapError(
      (cause: Schema.SchemaError) =>
        new SystemOneClassificationFailed({
          reason: { detail: cause.message, kind: "undecodable" },
        })
    )
  );
});

const categoryAnswerOf = Effect.fnUntraced(function* categoryAnswerOf(
  answered: SystemOneResponse
) {
  const answer = answered.answers[CATEGORY_QUESTION_ID];

  if (!answer) {
    return yield* new SystemOneClassificationFailed({
      reason: { detail: "no category answer", kind: "undecodable" },
    });
  }

  return answer;
});

const runAnswered = <A>(
  settings: SystemOneSettings,
  transport: ClassifierTransport,
  input: ClassificationInput,
  read: (
    answered: SystemOneResponse
  ) => Effect.Effect<A, SystemOneClassificationFailed>
): Promise<A> =>
  Effect.runPromise(
    readAnswers(settings, transport, input).pipe(
      Effect.flatMap(read),
      Effect.mapError(
        (failure: SystemOneClassificationFailed) => new Error(failure.message)
      )
    )
  );

type ChoiceAnswer = typeof ChoiceAnswerSchema.Type;

const likeliestAssignable = (
  answer: ChoiceAnswer,
  direction: ClassificationInput["direction"]
): { category: SpendingCategory; probability: number } | null => {
  if (isAssignableCategory(answer.choice, direction)) {
    return {
      category: answer.choice,
      probability: answer.certainty ?? answer.confidence,
    };
  }

  let likeliest: { category: SpendingCategory; probability: number } | null =
    null;

  for (const [category, probability] of Object.entries(
    answer.probabilities ?? {}
  )) {
    if (
      isAssignableCategory(category, direction) &&
      Number.isFinite(probability) &&
      probability > (likeliest?.probability ?? 0)
    ) {
      likeliest = { category, probability };
    }
  }

  return likeliest;
};

const readPrediction = Effect.fnUntraced(function* readPrediction(
  settings: SystemOneSettings,
  answered: SystemOneResponse,
  direction: ClassificationInput["direction"]
) {
  const answer = yield* categoryAnswerOf(answered);
  const picked = likeliestAssignable(answer, direction);

  if (!picked) {
    return yield* new SystemOneClassificationFailed({
      reason: { kind: "unoffered-category", value: answer.choice },
    });
  }

  const distribution = answer.probabilities;
  const sharpenable =
    settings.temperature !== NEUTRAL_TEMPERATURE && distribution !== undefined;

  const confidence = sharpenable
    ? concentration(
        Object.values(distribution),
        assignableCategories(direction).length,
        settings.temperature
      )
    : picked.probability;

  return {
    answeredBy: answered.model,
    category: picked.category,
    confidence,
  } satisfies ClassificationPrediction;
});

const classifyWith = (
  settings: SystemOneSettings,
  transport: ClassifierTransport,
  input: ClassificationInput
): Promise<ClassificationPrediction | null> =>
  runAnswered(settings, transport, input, (answered) =>
    readPrediction(settings, answered, input.direction)
  );

const SUGGESTION_FLOOR = 0.05;

const rankSuggestions = Effect.fnUntraced(function* rankSuggestions(
  answered: SystemOneResponse,
  direction: ClassificationInput["direction"],
  limit: number
) {
  const answer = yield* categoryAnswerOf(answered);
  const scores = new Map<SpendingCategory, number>();
  const candidates: [string, number][] = [
    [answer.choice, answer.certainty ?? answer.confidence],
    ...Object.entries(answer.probabilities ?? {}),
  ];

  for (const [category, score] of candidates) {
    if (
      isAssignableCategory(category, direction) &&
      score >= SUGGESTION_FLOOR
    ) {
      scores.set(category, Math.max(score, scores.get(category) ?? 0));
    }
  }

  return [...scores.entries()]
    .toSorted(([, left], [, right]) => right - left)
    .slice(0, limit)
    .map(([category]) => category);
});

export const suggestSystemOneCategories = (
  settings: SystemOneSettings,
  transport: ClassifierTransport,
  input: ClassificationInput,
  limit: number
): Promise<SpendingCategory[]> =>
  runAnswered(settings, transport, input, (answered) =>
    rankSuggestions(answered, input.direction, limit)
  );

export const createSystemOneClassifier = (
  settings: SystemOneSettings,
  transport: ClassifierTransport = fetch
): TransactionClassifier => ({
  classify: (input) => classifyWith(settings, transport, input),
  model: settings.model,
  provider: SYSTEM_ONE_PROVIDER,
});
