import { Data, Effect, Schedule, Schema } from "effect";

import type { Question } from "./questions";

const DECISIONS_URL = "https://api.subq.ai/v1/systemone";
const MODEL = "subq-snap-preview";
const RETRY_BASE_DELAY = "1 second";
const MAX_RETRIES = 4;
const REQUEST_TIMEOUT = "30 seconds";
const TOO_MANY_REQUESTS = 429;
const FIRST_SERVER_ERROR = 500;

const NoulAnswer = Schema.Struct({
  noul: Schema.Number,
  type: Schema.Literal("noul"),
});

const ChoiceAnswer = Schema.Struct({
  choice: Schema.String,
  confidence: Schema.Number,
  type: Schema.Literal("choice"),
});

const ScoreAnswer = Schema.Struct({
  confidence: Schema.Number,
  score: Schema.Number,
  type: Schema.Literal("score"),
});

const DecisionResponse = Schema.Struct({
  answers: Schema.Record(
    Schema.String,
    Schema.Union([NoulAnswer, ChoiceAnswer, ScoreAnswer])
  ),
});

export type DecisionState = Readonly<
  Record<string, string | boolean | readonly string[]>
>;

export type Answers = (typeof DecisionResponse.Type)["answers"];

type SubqFailure =
  | { readonly kind: "unreachable"; readonly detail: string }
  | {
      readonly kind: "rejected";
      readonly status: number;
      readonly body: string;
    }
  | { readonly kind: "undecodable"; readonly detail: string };

export class SubqRequestFailed extends Data.TaggedError("SubqRequestFailed")<{
  readonly reason: SubqFailure;
}> {
  get retryable(): boolean {
    const { reason } = this;

    if (reason.kind === "unreachable") {
      return true;
    }

    return (
      reason.kind === "rejected" &&
      (reason.status === TOO_MANY_REQUESTS ||
        reason.status >= FIRST_SERVER_ERROR)
    );
  }
}

const unreachable = (cause: unknown): SubqRequestFailed =>
  new SubqRequestFailed({
    reason: { detail: String(cause), kind: "unreachable" },
  });

const requestDecision = Effect.fnUntraced(function* requestDecision(
  apiKey: string,
  state: DecisionState,
  questions: Record<string, Question>
) {
  const response = yield* Effect.tryPromise({
    catch: unreachable,
    try: (signal) =>
      fetch(DECISIONS_URL, {
        body: JSON.stringify({ model: MODEL, questions, state }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal,
      }),
  });

  if (!response.ok) {
    const body = yield* Effect.tryPromise({
      catch: unreachable,
      try: () => response.text(),
    });

    return yield* new SubqRequestFailed({
      reason: { body, kind: "rejected", status: response.status },
    });
  }

  const payload = yield* Effect.tryPromise({
    catch: (cause) =>
      new SubqRequestFailed({
        reason: { detail: String(cause), kind: "undecodable" },
      }),
    try: () => response.json(),
  });

  const decoded = yield* Schema.decodeUnknownEffect(DecisionResponse)(
    payload
  ).pipe(
    Effect.mapError(
      (cause: Schema.SchemaError) =>
        new SubqRequestFailed({
          reason: { detail: cause.message, kind: "undecodable" },
        })
    )
  );

  return decoded.answers;
});

export const decide = (
  apiKey: string,
  state: DecisionState,
  questions: Record<string, Question>
): Effect.Effect<Answers, SubqRequestFailed> =>
  requestDecision(apiKey, state, questions).pipe(
    Effect.timeoutOrElse({
      duration: REQUEST_TIMEOUT,
      orElse: () =>
        Effect.fail(
          new SubqRequestFailed({
            reason: { detail: "timed out", kind: "unreachable" },
          })
        ),
    }),
    Effect.retry({
      schedule: Schedule.exponential(RETRY_BASE_DELAY),
      times: MAX_RETRIES,
      while: (failure) => failure.retryable,
    })
  );
