import { Data, Effect, Match, Schema } from "effect";

import {
  ACCEPT_CONFIDENCE,
  concentration,
  NEUTRAL_TEMPERATURE,
} from "../confidence";
import { CLASSIFIER_REQUEST_TIMEOUT_MS, endpointHeaders } from "../endpoint";
import {
  CATEGORY_QUESTION_ID,
  isOfferedCategory,
  offeredCategories,
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
        reason: { detail: String(cause), kind: "unreachable" },
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
        signal: AbortSignal.timeout(CLASSIFIER_REQUEST_TIMEOUT_MS),
      }),
  });

  if (!response.ok) {
    const body = yield* Effect.tryPromise({
      catch: (cause) =>
        new SystemOneClassificationFailed({
          reason: { detail: String(cause), kind: "unreachable" },
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

const readPrediction = Effect.fnUntraced(function* readPrediction(
  settings: SystemOneSettings,
  answered: SystemOneResponse,
  direction: ClassificationInput["direction"]
) {
  const answer = answered.answers[CATEGORY_QUESTION_ID];

  if (!answer) {
    return yield* new SystemOneClassificationFailed({
      reason: { detail: "no category answer", kind: "undecodable" },
    });
  }

  const category = answer.choice;

  if (!isOfferedCategory(category, direction)) {
    return yield* new SystemOneClassificationFailed({
      reason: { kind: "unoffered-category", value: category },
    });
  }

  if (category === "uncategorised") {
    return null;
  }

  const distribution = answer.probabilities;
  const sharpenable =
    settings.temperature !== NEUTRAL_TEMPERATURE && distribution !== undefined;

  const confidence = sharpenable
    ? concentration(
        Object.values(distribution),
        offeredCategories(direction).length,
        settings.temperature
      )
    : (answer.certainty ?? answer.confidence);

  if (confidence < ACCEPT_CONFIDENCE) {
    return null;
  }

  return {
    answeredBy: answered.model,
    category,
    confidence,
  };
});

const classifyWith = (
  settings: SystemOneSettings,
  transport: ClassifierTransport,
  input: ClassificationInput
): Promise<ClassificationPrediction | null> =>
  Effect.runPromise(
    readAnswers(settings, transport, input).pipe(
      Effect.flatMap((answered) =>
        readPrediction(settings, answered, input.direction)
      ),
      Effect.mapError(
        (failure: SystemOneClassificationFailed) => new Error(failure.message)
      )
    )
  );

export const createSystemOneClassifier = (
  settings: SystemOneSettings,
  transport: ClassifierTransport = fetch
): TransactionClassifier => ({
  classify: (input) => classifyWith(settings, transport, input),
  model: settings.model,
  provider: SYSTEM_ONE_PROVIDER,
});
