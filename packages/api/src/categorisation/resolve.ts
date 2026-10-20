import { Data, Effect, Match, Option } from "effect";

import type { SpendingCategory } from "../lib/taxonomy";
import { categoryDirection, isSpendingCategory } from "../lib/taxonomy";
import { classificationInputFrom } from "./classifier/payload";
import {
  classificationSignature,
  payloadSignature,
} from "./classifier/signature";
import type { ClassificationStore } from "./classifier/store";
import type {
  ClassificationInput,
  ClassificationPrediction,
  TransactionClassifier,
} from "./classifier/types";
import { deterministicCategory, readsAsRefund } from "./deterministic";
import {
  loadDictionary,
  lookupDictionary,
  unloadDictionary,
} from "./dictionary";
import { keywordsFor } from "./keywords";
import type { TransactionChannel } from "./normalise/types";
import type {
  CategoriseInput,
  DictionaryEntry,
  Iso3166Alpha2Country,
  ResolutionResult,
  ResolutionStage,
} from "./types";
import { lookupUserOverride } from "./user-override";

type ClassificationCallReason =
  | { readonly kind: "threw"; readonly detail: string }
  | { readonly kind: "timeout"; readonly afterMs: number }
  | { readonly kind: "unusable-answer"; readonly detail: string };

class ClassificationCallFailed extends Data.TaggedError(
  "ClassificationCallFailed"
)<{
  readonly provider: string;
  readonly reason: ClassificationCallReason;
}> {
  override get message(): string {
    const { provider } = this;

    return Match.value(this.reason).pipe(
      Match.discriminatorsExhaustive("kind")({
        threw: ({ detail }) =>
          `classifier ${provider} failed for one merchant: ${detail}`,
        timeout: ({ afterMs }) =>
          `classifier ${provider} answered nothing within ${afterMs}ms for one merchant`,
        "unusable-answer": ({ detail }) =>
          `classifier ${provider} answered outside the contract: ${detail}`,
      })
    );
  }
}

interface PendingGroup {
  payload: ClassificationInput;
  indices: number[];
}

interface ClassificationPhase {
  classifiers: readonly TransactionClassifier[];
  escalateBelow: number;
  onSignatureSettled: () => Promise<void>;
  store: ClassificationStore;
  timeoutMs: number;
}

type ProviderOutcome =
  | {
      readonly kind: "answered";
      readonly prediction: ClassificationPrediction;
      readonly stage: ResolutionStage;
    }
  | { readonly kind: "silent" };

export interface CategoriseBatchOptions {
  countries: Iso3166Alpha2Country[] | undefined;
  classifiers: readonly TransactionClassifier[];
  escalateBelow?: number;
  onSignatureSettled?: () => Promise<void>;
  store: ClassificationStore;
  timeoutMs?: number;
}

const CHANNEL_CATEGORY = {
  atm: "cash-withdrawal",
  cheque: "uncategorised",
  fee: "loans-bank-fees",
} as const satisfies Partial<Record<TransactionChannel, SpendingCategory>>;

const UNKNOWN_RESULT: ResolutionResult = {
  band: "unknown",
  category: null,
  confidence: 0,
  intermediaryName: null,
  merchantName: null,
  stage: "none",
};

const CHANNEL_CONFIDENCE = 0.9;
const USER_OVERRIDE_CONFIDENCE = 1;
const DICTIONARY_CONFIDENCE = 0.85;
const AUTO_BAND_MIN_CONFIDENCE = 0.85;

const MIN_BRAND_KEY_LENGTH = 3;

export const merchantKeyCandidates = (
  merchantKey: string,
  country: Iso3166Alpha2Country | null | undefined
): string[] => {
  const candidates = [merchantKey];
  const { merchantQualifiers } = keywordsFor(country);
  const parts = merchantKey.split(" ");

  for (let end = parts.length - 1; end >= 1; end -= 1) {
    const tail = parts[end];

    if (!(tail && merchantQualifiers.has(tail))) {
      break;
    }

    const candidate = parts.slice(0, end).join(" ");

    if (candidate.length < MIN_BRAND_KEY_LENGTH) {
      break;
    }

    candidates.push(candidate);
  }

  return candidates;
};

const lookupMerchant = async (
  merchantKey: string,
  country: Iso3166Alpha2Country | null | undefined
): Promise<DictionaryEntry | null> => {
  for (const candidate of merchantKeyCandidates(merchantKey, country)) {
    // eslint-disable-next-line no-await-in-loop -- ordered, exits on first hit
    const hit = await lookupDictionary(candidate);

    if (hit) {
      return hit;
    }
  }

  return null;
};

const hasChannelCategory = (
  channel: TransactionChannel
): channel is keyof typeof CHANNEL_CATEGORY =>
  Object.hasOwn(CHANNEL_CATEGORY, channel);

const fromChannel = (input: CategoriseInput): ResolutionResult | null => {
  if (!hasChannelCategory(input.channel)) {
    return null;
  }

  const channelCategory = CHANNEL_CATEGORY[input.channel];

  return {
    band: "auto",
    category: channelCategory,
    confidence: CHANNEL_CONFIDENCE,
    intermediaryName: null,
    merchantName: null,
    stage: "channel",
  };
};

const fromUserOverride = async (
  input: CategoriseInput
): Promise<ResolutionResult | null> => {
  const override = await lookupUserOverride(input.userId, input.merchantKey);

  if (!override) {
    return null;
  }

  return {
    band: "auto",
    category: override.category,
    confidence: USER_OVERRIDE_CONFIDENCE,
    intermediaryName: null,
    merchantName: override.merchantName,
    stage: "user-override",
  };
};

const fromDictionary = async (
  input: CategoriseInput
): Promise<ResolutionResult | null> => {
  const entry = await lookupMerchant(input.merchantKey, input.country);

  if (!entry) {
    return null;
  }

  return {
    band: "auto",
    category: entry.category,
    confidence: DICTIONARY_CONFIDENCE,
    intermediaryName: null,
    merchantName: entry.name,
    stage: "dictionary",
  };
};

const fromDeterministicRules = (
  input: CategoriseInput
): ResolutionResult | null => {
  const deterministic = deterministicCategory(input);

  if (!deterministic) {
    return null;
  }

  return {
    band: "auto",
    category: deterministic.category,
    confidence: deterministic.confidence,
    intermediaryName: null,
    merchantName: null,
    stage: deterministic.stage,
  };
};

const inDirection = (
  resolution: ResolutionResult | null,
  amountMinor: CategoriseInput["amountMinor"]
): ResolutionResult | null =>
  resolution?.category && readsAsRefund(resolution.category, amountMinor)
    ? null
    : resolution;

const categoriseInternal = async (
  input: CategoriseInput
): Promise<ResolutionResult> => {
  const byChannel = inDirection(fromChannel(input), input.amountMinor);

  if (byChannel) {
    return byChannel;
  }

  if (input.merchantKey.length > 0) {
    const byOverride = inDirection(
      await fromUserOverride(input),
      input.amountMinor
    );

    if (byOverride) {
      return byOverride;
    }

    const byDictionary = inDirection(
      await fromDictionary(input),
      input.amountMinor
    );

    if (byDictionary) {
      return byDictionary;
    }
  }

  return fromDeterministicRules(input) ?? UNKNOWN_RESULT;
};

export const categoriseTransaction = async (
  input: CategoriseInput
): Promise<ResolutionResult> =>
  Option.getOrElse(
    await categoriseInternal(input).then(Option.some, Option.none),
    () => UNKNOWN_RESULT
  );

const categoriseInOrder = async (
  transactions: CategoriseInput[]
): Promise<ResolutionResult[]> => {
  const results: ResolutionResult[] = [];

  for (const tx of transactions) {
    // eslint-disable-next-line no-await-in-loop -- sequential: each lookup may hit the DB for user overrides
    results.push(await categoriseTransaction(tx));
  }

  return results;
};

const CLASSIFIER_CONCURRENCY = 4;
const CLASSIFIER_TIMEOUT_MS = 15_000;
const ABSTENTION_RETRY_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

const noProgress = (): Promise<void> => Promise.resolve();

const groupPending = (
  transactions: CategoriseInput[],
  results: ResolutionResult[]
): Map<string, PendingGroup> => {
  const groups = new Map<string, PendingGroup>();

  for (const [index, resolution] of results.entries()) {
    if (resolution.stage !== "none") {
      continue;
    }

    const transaction = transactions[index];
    const payload = transaction ? classificationInputFrom(transaction) : null;

    if (!payload) {
      continue;
    }

    const signature = payloadSignature(payload);
    const existing = groups.get(signature);

    if (existing) {
      existing.indices.push(index);
    } else {
      groups.set(signature, { indices: [index], payload });
    }
  }

  return groups;
};

const applyModelResult = (
  results: ResolutionResult[],
  indices: number[],
  category: SpendingCategory,
  confidence: number,
  stage: ResolutionStage
): void => {
  const resolution: ResolutionResult = {
    band: confidence >= AUTO_BAND_MIN_CONFIDENCE ? "auto" : "suggest",
    category,
    confidence,
    intermediaryName: null,
    merchantName: null,
    stage,
  };

  for (const index of indices) {
    results[index] = resolution;
  }
};

const contradictsDirection = (
  category: SpendingCategory,
  direction: ClassificationInput["direction"]
): boolean => {
  const allowed = categoryDirection(category);
  const wanted = direction === "credit" ? "in" : "out";

  return allowed !== "both" && allowed !== wanted;
};

const acceptedPrediction = (
  prediction: ClassificationPrediction,
  provider: string,
  direction: ClassificationInput["direction"]
): Effect.Effect<ClassificationPrediction, ClassificationCallFailed> => {
  const { category, confidence } = prediction;

  if (!isSpendingCategory(category)) {
    return Effect.fail(
      new ClassificationCallFailed({
        provider,
        reason: {
          detail: `unknown category ${category}`,
          kind: "unusable-answer",
        },
      })
    );
  }

  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return Effect.fail(
      new ClassificationCallFailed({
        provider,
        reason: {
          detail: `confidence ${confidence} is outside 0..1`,
          kind: "unusable-answer",
        },
      })
    );
  }

  if (contradictsDirection(category, direction)) {
    return Effect.fail(
      new ClassificationCallFailed({
        provider,
        reason: {
          detail: `category ${category} cannot describe a ${direction}`,
          kind: "unusable-answer",
        },
      })
    );
  }

  return Effect.succeed(prediction);
};

const askClassifier = Effect.fnUntraced(function* askClassifier(
  classifier: TransactionClassifier,
  timeoutMs: number,
  payload: ClassificationInput
) {
  const { provider } = classifier;
  const prediction = yield* Effect.tryPromise({
    catch: (cause) =>
      new ClassificationCallFailed({
        provider,
        reason: { detail: String(cause), kind: "threw" },
      }),
    try: () => classifier.classify(payload),
  }).pipe(
    Effect.timeoutOrElse({
      duration: timeoutMs,
      orElse: () =>
        Effect.fail(
          new ClassificationCallFailed({
            provider,
            reason: { afterMs: timeoutMs, kind: "timeout" },
          })
        ),
    })
  );

  return prediction
    ? yield* acceptedPrediction(prediction, provider, payload.direction)
    : null;
});

const consultClassifier = Effect.fnUntraced(function* consultClassifier(
  phase: ClassificationPhase,
  classifier: TransactionClassifier,
  payload: ClassificationInput
) {
  const signature = classificationSignature(classifier, payload);
  const cached = yield* Effect.promise(() => phase.store.find(signature));

  if (cached?.category) {
    return {
      kind: "answered",
      prediction: {
        category: cached.category,
        confidence: cached.confidence ?? 0,
      },
      stage: "cached-model",
    } satisfies ProviderOutcome;
  }

  const abstainedRecently =
    cached !== null &&
    Date.now() - cached.classifiedAt.getTime() < ABSTENTION_RETRY_AFTER_MS;

  if (abstainedRecently) {
    return { kind: "silent" } satisfies ProviderOutcome;
  }

  const prediction = yield* askClassifier(
    classifier,
    phase.timeoutMs,
    payload
  ).pipe(
    Effect.match({
      onFailure: (failure: ClassificationCallFailed) => {
        console.warn(`[categorisation] ${failure.message}`);

        return Option.none<ClassificationPrediction | null>();
      },
      onSuccess: Option.some,
    })
  );

  if (Option.isNone(prediction)) {
    return { kind: "silent" } satisfies ProviderOutcome;
  }

  const answer = prediction.value;

  yield* Effect.promise(() =>
    phase.store.save(signature, {
      answeredBy: answer?.answeredBy ?? null,
      category: answer?.category ?? null,
      classifier,
      confidence: answer?.confidence ?? null,
    })
  );

  return answer
    ? ({
        kind: "answered",
        prediction: answer,
        stage: "model",
      } satisfies ProviderOutcome)
    : ({ kind: "silent" } satisfies ProviderOutcome);
});

const resolveGroup = Effect.fnUntraced(function* resolveGroup(
  phase: ClassificationPhase,
  results: ResolutionResult[],
  group: PendingGroup
) {
  let best: Extract<ProviderOutcome, { kind: "answered" }> | null = null;

  for (const classifier of phase.classifiers) {
    const outcome = yield* consultClassifier(phase, classifier, group.payload);

    if (
      outcome.kind === "answered" &&
      (best === null ||
        outcome.prediction.confidence > best.prediction.confidence)
    ) {
      best = outcome;
    }

    if (best !== null && best.prediction.confidence >= phase.escalateBelow) {
      break;
    }
  }

  if (best !== null) {
    applyModelResult(
      results,
      group.indices,
      best.prediction.category,
      best.prediction.confidence,
      best.stage
    );
  }
});

const classifyPending = Effect.fnUntraced(function* classifyPending(
  phase: ClassificationPhase,
  transactions: CategoriseInput[],
  results: ResolutionResult[]
) {
  const groups = groupPending(transactions, results);

  yield* Effect.forEach(
    [...groups.values()],
    (group) =>
      resolveGroup(phase, results, group).pipe(
        Effect.flatMap(() => Effect.promise(phase.onSignatureSettled))
      ),
    { concurrency: CLASSIFIER_CONCURRENCY }
  ).pipe(
    Effect.catchCause((cause) => {
      const chain = phase.classifiers
        .map((classifier) => classifier.provider)
        .join(" then ");

      console.warn(
        `[categorisation] classifier ${chain} phase abandoned: ${cause}`
      );

      return Effect.void;
    })
  );
});

const categoriseAll = async (
  transactions: CategoriseInput[],
  options: CategoriseBatchOptions
): Promise<ResolutionResult[]> => {
  const results = await categoriseInOrder(transactions);

  if (options.classifiers.length === 0) {
    return results;
  }

  await Effect.runPromise(
    classifyPending(
      {
        classifiers: options.classifiers,
        escalateBelow: options.escalateBelow ?? AUTO_BAND_MIN_CONFIDENCE,
        onSignatureSettled: options.onSignatureSettled ?? noProgress,
        store: options.store,
        timeoutMs: options.timeoutMs ?? CLASSIFIER_TIMEOUT_MS,
      },
      transactions,
      results
    )
  );

  return results;
};

export const categoriseBatch = async (
  transactions: CategoriseInput[],
  options: CategoriseBatchOptions
): Promise<ResolutionResult[]> => {
  if (transactions.length === 0) {
    return [];
  }

  await loadDictionary(options.countries);

  return await categoriseAll(transactions, options).finally(unloadDictionary);
};
