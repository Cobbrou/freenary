import type { CLASSIFIER_PROTOCOLS } from "@freenary/env/schema";
import { env } from "@freenary/env/server";
import type { ServerSettings } from "@freenary/instance-config";
import { settings as instanceSettings } from "@freenary/instance-config";
import { Data, Match, Result } from "effect";

import { createLlmClassifier } from "./providers/llm";
import { createSystemOneClassifier } from "./providers/system-one";
import { createZeroShotClassifier } from "./providers/zero-shot";
import type { ClassifierTransport, TransactionClassifier } from "./types";

export type ClassifierProtocol = (typeof CLASSIFIER_PROTOCOLS)[number];

export interface ClassifierSlotSettings {
  apiKey: string | undefined;
  model: string | undefined;
  protocol: ClassifierProtocol | undefined;
  temperature: number;
  url: string | undefined;
}

export interface ClassifierSettings {
  fallback: ClassifierSlotSettings;
  primary: ClassifierSlotSettings;
}

export type ClassifierChain = Result.Result<
  readonly TransactionClassifier[],
  ClassifierUnavailable
>;

export class ClassifierUnavailable extends Data.TaggedError(
  "ClassifierUnavailable"
)<{
  readonly message: string;
  readonly variable: string;
}> {}

const PRIMARY_VARIABLE = "TRANSACTION_CLASSIFIER";
const FALLBACK_VARIABLE = "TRANSACTION_CLASSIFIER_FALLBACK";

const requiredSetting = (
  value: string | undefined,
  slot: string,
  protocol: ClassifierProtocol,
  suffix: string
): Result.Result<string, ClassifierUnavailable> =>
  Result.fromNullishOr(
    value !== undefined && value.length > 0 ? value : undefined,
    () =>
      new ClassifierUnavailable({
        message: `${slot}=${protocol} requires ${slot}_${suffix} to be set.`,
        variable: `${slot}_${suffix}`,
      })
  );

const buildClassifier = (
  slot: string,
  protocol: ClassifierProtocol,
  settings: ClassifierSlotSettings,
  transport: ClassifierTransport
): Result.Result<TransactionClassifier, ClassifierUnavailable> =>
  Result.flatMap(requiredSetting(settings.url, slot, protocol, "URL"), (url) =>
    Result.map(
      requiredSetting(settings.model, slot, protocol, "MODEL"),
      (model) => {
        const endpoint = {
          apiKey: settings.apiKey,
          model,
          temperature: settings.temperature,
          url,
        };

        return Match.value(protocol).pipe(
          Match.when("system-one", () =>
            createSystemOneClassifier(endpoint, transport)
          ),
          Match.when("llm", () => createLlmClassifier(endpoint, transport)),
          Match.when("zero-shot", () =>
            createZeroShotClassifier(endpoint, transport)
          ),
          Match.exhaustive
        );
      }
    )
  );

export const createClassifierChain = (
  settings: ClassifierSettings,
  transport: ClassifierTransport = fetch
): ClassifierChain => {
  const { fallback, primary } = settings;
  const first = primary.protocol;
  const escalation = fallback.protocol;

  if (first === undefined) {
    return escalation === undefined
      ? Result.succeed([])
      : Result.fail(
          new ClassifierUnavailable({
            message: `${FALLBACK_VARIABLE} needs ${PRIMARY_VARIABLE} to name the classifier asked first.`,
            variable: PRIMARY_VARIABLE,
          })
        );
  }

  if (escalation === undefined) {
    return Result.map(
      buildClassifier(PRIMARY_VARIABLE, first, primary, transport),
      (classifier) => [classifier]
    );
  }

  if (escalation === first && fallback.model === primary.model) {
    return Result.fail(
      new ClassifierUnavailable({
        message: `${FALLBACK_VARIABLE}=${escalation} names the protocol and the model that answer first, so both slots would share one cache row.`,
        variable: FALLBACK_VARIABLE,
      })
    );
  }

  return Result.flatMap(
    buildClassifier(PRIMARY_VARIABLE, first, primary, transport),
    (answered) =>
      Result.map(
        buildClassifier(FALLBACK_VARIABLE, escalation, fallback, transport),
        (escalated) => [answered, escalated]
      )
  );
};

export const primarySlotOf = (
  settings: ServerSettings
): ClassifierSlotSettings => ({
  apiKey: settings.TRANSACTION_CLASSIFIER_API_KEY,
  model: settings.TRANSACTION_CLASSIFIER_MODEL,
  protocol: settings.TRANSACTION_CLASSIFIER,
  temperature: settings.TRANSACTION_CLASSIFIER_TEMPERATURE,
  url: settings.TRANSACTION_CLASSIFIER_URL,
});

export const classifierSettingsOf = (
  settings: ServerSettings
): ClassifierSettings => ({
  fallback: {
    apiKey: settings.TRANSACTION_CLASSIFIER_FALLBACK_API_KEY,
    model: settings.TRANSACTION_CLASSIFIER_FALLBACK_MODEL,
    protocol: settings.TRANSACTION_CLASSIFIER_FALLBACK,
    temperature: settings.TRANSACTION_CLASSIFIER_FALLBACK_TEMPERATURE,
    url: settings.TRANSACTION_CLASSIFIER_FALLBACK_URL,
  },
  primary: primarySlotOf(settings),
});

const environmentChain = (fault: ClassifierUnavailable) => {
  console.warn(
    `${fault.message} The stored classifier is ignored, and the environment alone is in force.`
  );

  return Result.getOrThrow(createClassifierChain(classifierSettingsOf(env)));
};

export const transactionClassifiers = Result.getOrElse(
  createClassifierChain(classifierSettingsOf(instanceSettings)),
  environmentChain
);

export const classifierEscalateBelow =
  instanceSettings.TRANSACTION_CLASSIFIER_ESCALATE_BELOW;
