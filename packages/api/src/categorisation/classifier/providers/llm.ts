import { Data, Effect, Match, Schema } from "effect";

import type { SpendingCategory } from "../../../lib/taxonomy";
import {
  ACCEPT_CONFIDENCE,
  concentration,
  NEUTRAL_TEMPERATURE,
  softmax,
  UNDISTRIBUTED_CONFIDENCE,
} from "../confidence";
import { CLASSIFIER_REQUEST_TIMEOUT_MS, endpointHeaders } from "../endpoint";
import {
  CATEGORY_CRITERIA,
  CATEGORY_INSTRUCTIONS,
  offeredCategories,
} from "../questions";
import type {
  ClassificationInput,
  ClassificationPrediction,
  ClassifierTransport,
  TransactionClassifier,
  TransactionDirection,
} from "../types";

export interface LlmSettings {
  apiKey: string | undefined;
  model: string;
  temperature: number;
  url: string;
}

interface DirectionTable {
  readonly categoryByLetter: Readonly<Record<string, SpendingCategory>>;
  readonly offeredCount: number;
  readonly system: string;
}

interface LetterDistribution {
  readonly letters: readonly string[];
  readonly logprobs: readonly number[];
}

interface LetterReading {
  readonly confidence: number;
  readonly letter: string;
}

type LlmClassificationReason =
  | { readonly kind: "unreachable"; readonly detail: string }
  | {
      readonly kind: "rejected";
      readonly status: number;
      readonly body: string;
    }
  | { readonly kind: "undecodable"; readonly detail: string }
  | { readonly kind: "unoffered-letter"; readonly value: string };

export class LlmClassificationFailed extends Data.TaggedError(
  "LlmClassificationFailed"
)<{
  readonly reason: LlmClassificationReason;
}> {
  override get message(): string {
    return Match.value(this.reason).pipe(
      Match.discriminatorsExhaustive("kind")({
        rejected: ({ body, status }) =>
          `the endpoint refused the classification: ${status} ${body}`,
        undecodable: ({ detail }) =>
          `the endpoint answered outside the chat-completions shape: ${detail}`,
        "unoffered-letter": ({ value }) =>
          `the endpoint answered with a letter this transaction cannot take: ${value || "none"}`,
        unreachable: ({ detail }) => `the endpoint is unreachable: ${detail}`,
      })
    );
  }
}

const LLM_ANSWER_TOKEN_BUDGET = 2;
const LLM_SAMPLING_TEMPERATURE = 0;
const COMPLETIONS_PATH = "/chat/completions";
const TRAILING_SLASHES = /\/+$/u;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const ANSWER_RULE =
  "Answer with the letter of one option and nothing else. Write no punctuation, no category name and no explanation.";

const tableFor = (direction: TransactionDirection): DirectionTable => {
  const offered = offeredCategories(direction);
  const options = offered
    .map(
      (category, index) =>
        `(${ALPHABET.charAt(index)}) ${category} — ${CATEGORY_CRITERIA[category]}`
    )
    .join("\n");

  return {
    categoryByLetter: Object.fromEntries(
      offered.map((category, index): [string, SpendingCategory] => [
        ALPHABET.charAt(index),
        category,
      ])
    ),
    offeredCount: offered.length,
    system: `${CATEGORY_INSTRUCTIONS}\n\n${options}\n\n${ANSWER_RULE}`,
  };
};

const TABLE_BY_DIRECTION = {
  credit: tableFor("credit"),
  debit: tableFor("debit"),
} as const satisfies Record<TransactionDirection, DirectionTable>;

const TopLogprobSchema = Schema.Struct({
  logprob: Schema.Number,
  token: Schema.String,
});

const ChoiceSchema = Schema.Struct({
  logprobs: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        content: Schema.optional(
          Schema.NullOr(
            Schema.Array(
              Schema.Struct({
                top_logprobs: Schema.optional(
                  Schema.NullOr(Schema.Array(TopLogprobSchema))
                ),
              })
            )
          )
        ),
      })
    )
  ),
  message: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        content: Schema.optional(Schema.NullOr(Schema.String)),
      })
    )
  ),
});

const LlmResponseSchema = Schema.Struct({
  choices: Schema.Array(ChoiceSchema),
  model: Schema.optional(Schema.NullOr(Schema.String)),
});

type LlmResponse = typeof LlmResponseSchema.Type;

type LlmChoice = typeof ChoiceSchema.Type;

type TopLogprob = typeof TopLogprobSchema.Type;

const rankLetters = (
  entries: readonly TopLogprob[] | null | undefined,
  table: DirectionTable
): LetterDistribution => {
  const highest = new Map<string, number>();

  for (const entry of entries ?? []) {
    const letter = entry.token.trim().charAt(0).toUpperCase();
    const known = highest.get(letter);

    if (table.categoryByLetter[letter] === undefined) {
      continue;
    }

    if (known === undefined || entry.logprob > known) {
      highest.set(letter, entry.logprob);
    }
  }

  return { letters: [...highest.keys()], logprobs: [...highest.values()] };
};

const readLetter = (
  choice: LlmChoice,
  table: DirectionTable,
  temperature: number
): LetterReading => {
  const ranked = rankLetters(
    choice.logprobs?.content?.[0]?.top_logprobs,
    table
  );

  if (ranked.letters.length === 0) {
    return {
      confidence: UNDISTRIBUTED_CONFIDENCE,
      letter: (choice.message?.content ?? "").trim().charAt(0).toUpperCase(),
    };
  }

  const probabilities = softmax(ranked.logprobs, temperature);
  const argmax = probabilities.indexOf(Math.max(...probabilities));

  return {
    confidence: concentration(
      probabilities,
      table.offeredCount,
      NEUTRAL_TEMPERATURE
    ),
    letter: ranked.letters[argmax] ?? "",
  };
};

const readCompletion = Effect.fnUntraced(function* readCompletion(
  settings: LlmSettings,
  transport: ClassifierTransport,
  input: ClassificationInput
) {
  const table = TABLE_BY_DIRECTION[input.direction];
  const response = yield* Effect.tryPromise({
    catch: (cause) =>
      new LlmClassificationFailed({
        reason: { detail: String(cause), kind: "unreachable" },
      }),
    try: () =>
      transport(
        `${settings.url.replace(TRAILING_SLASHES, "")}${COMPLETIONS_PATH}`,
        {
          body: JSON.stringify({
            logprobs: true,
            max_tokens: LLM_ANSWER_TOKEN_BUDGET,
            messages: [
              { content: table.system, role: "system" },
              { content: JSON.stringify(input), role: "user" },
            ],
            model: settings.model,
            temperature: LLM_SAMPLING_TEMPERATURE,
            top_logprobs: table.offeredCount,
          }),
          headers: endpointHeaders(settings.apiKey),
          method: "POST",
          signal: AbortSignal.timeout(CLASSIFIER_REQUEST_TIMEOUT_MS),
        }
      ),
  });

  if (!response.ok) {
    const body = yield* Effect.tryPromise({
      catch: (cause) =>
        new LlmClassificationFailed({
          reason: { detail: String(cause), kind: "unreachable" },
        }),
      try: () => response.text(),
    });

    return yield* new LlmClassificationFailed({
      reason: { body, kind: "rejected", status: response.status },
    });
  }

  const payload = yield* Effect.tryPromise({
    catch: (cause) =>
      new LlmClassificationFailed({
        reason: { detail: String(cause), kind: "undecodable" },
      }),
    try: () => response.json(),
  });

  return yield* Schema.decodeUnknownEffect(LlmResponseSchema)(payload).pipe(
    Effect.mapError(
      (cause: Schema.SchemaError) =>
        new LlmClassificationFailed({
          reason: { detail: cause.message, kind: "undecodable" },
        })
    )
  );
});

const readPrediction = Effect.fnUntraced(function* readPrediction(
  answered: LlmResponse,
  settings: LlmSettings,
  direction: TransactionDirection
) {
  const [choice] = answered.choices;

  if (!choice) {
    return yield* new LlmClassificationFailed({
      reason: { detail: "the answer carries no choice", kind: "undecodable" },
    });
  }

  const table = TABLE_BY_DIRECTION[direction];
  const { confidence, letter } = readLetter(
    choice,
    table,
    settings.temperature
  );

  const category = table.categoryByLetter[letter];

  if (!category) {
    return yield* new LlmClassificationFailed({
      reason: { kind: "unoffered-letter", value: letter },
    });
  }

  if (category === "uncategorised") {
    return null;
  }

  if (confidence < ACCEPT_CONFIDENCE) {
    return null;
  }

  return {
    answeredBy: answered.model ?? settings.model,
    category,
    confidence,
  };
});

const classifyWith = (
  settings: LlmSettings,
  transport: ClassifierTransport,
  input: ClassificationInput
): Promise<ClassificationPrediction | null> =>
  Effect.runPromise(
    readCompletion(settings, transport, input).pipe(
      Effect.flatMap((answered) =>
        readPrediction(answered, settings, input.direction)
      ),
      Effect.mapError(
        (failure: LlmClassificationFailed) => new Error(failure.message)
      )
    )
  );

export const createLlmClassifier = (
  settings: LlmSettings,
  transport: ClassifierTransport = fetch
): TransactionClassifier => ({
  classify: (input) => classifyWith(settings, transport, input),
  model: settings.model,
  provider: "llm",
});
