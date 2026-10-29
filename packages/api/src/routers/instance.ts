import type {
  HeldValue,
  Integration,
  IntegrationField,
  IntegrationVariant,
  ServerSettings,
  ServerSettingKey,
  SettingSource,
  StoredSettings,
} from "@freenary/instance-config";
import {
  environmentOwns,
  findIntegration,
  findVariant,
  instanceConfigFault,
  instanceConfigurableKeys,
  integrations,
  isListedFor,
  isRequiredForSetup,
  isSecretField,
  isShownInSetup,
  markSetupComplete,
  readSetupState,
  readStoredSettings,
  recogniseVariant,
  rememberedVariantKey,
  settings,
  storedSettingsAtBoot,
  validateSettings,
  writeStoredSettings,
} from "@freenary/instance-config";
import { ORPCError } from "@orpc/server";
import { Effect, Option, Result } from "effect";
import { z } from "zod";

import {
  classifierSettingsOf,
  createClassifierChain,
} from "../categorisation/classifier/registry";
import {
  isOperator,
  operatorProcedure,
  protectedProcedure,
  publicProcedure,
} from "../index";
import { maskEnvironmentValue } from "../instance/mask";
import {
  candidateOf,
  conflictingPresetsOf,
  environmentVariantOf,
  isWhollyOwnedByEnvironment,
  missingKeysOf,
  writesOf,
} from "../instance/merge";
import { capProbeDetail, findProbe } from "../instance/probes";
import { visibleTo } from "../instance/release";
import {
  DISABLED_VARIANT,
  integrationStateOf,
  missingForSetup,
} from "../instance/setup";
import { updateCheck } from "../instance/update-check";
import { bankConnectionCount } from "./bank-connection-count";

const RESTART_GRACE_MS = 250;

const readCurrentSettings = (): Promise<StoredSettings> =>
  Effect.runPromise(readStoredSettings(settings.BETTER_AUTH_SECRET));

const sourceFor = (
  key: ServerSettingKey,
  stored: StoredSettings
): SettingSource => {
  if (environmentOwns(key)) {
    return "environment";
  }

  return stored[key] === undefined ? "unset" : "instance";
};

const heldValue = (
  key: ServerSettingKey,
  stored: StoredSettings
): string | null => {
  if (!environmentOwns(key)) {
    return stored[key] ?? null;
  }

  const fromEnvironment = settings[key];

  return fromEnvironment === undefined ? null : String(fromEnvironment);
};

const selectedVariantOf = (
  integration: Integration,
  stored: StoredSettings
): string =>
  Option.match(
    recogniseVariant(
      integration,
      (key) => heldValue(key, stored) ?? undefined,
      stored[rememberedVariantKey(integration)]
    ),
    {
      onNone: () => DISABLED_VARIANT,
      onSome: (variant) => variant.id,
    }
  );

const MASKED_KINDS: ReadonlySet<IntegrationField["kind"]> = new Set([
  "text",
  "url",
]);

const shownValueOf = (
  field: IntegrationField,
  held: string | null
): string | null => {
  if (held === null || isSecretField(field.kind)) {
    return null;
  }

  return environmentOwns(field.key) && MASKED_KINDS.has(field.kind)
    ? maskEnvironmentValue(held)
    : held;
};

const describeField = (
  field: IntegrationField,
  stored: StoredSettings,
  isSelected: boolean
) => {
  const held =
    isSelected || environmentOwns(field.key)
      ? heldValue(field.key, stored)
      : null;

  return {
    key: field.key,
    kind: field.kind,
    present: held !== null,
    required: field.required,
    source: sourceFor(field.key, stored),
    suggestion: field.suggestion ?? null,
    value: shownValueOf(field, held),
  };
};

const environmentSettings = Result.getOrUndefined(validateSettings({}));

const heldInEnvironment: HeldValue = (key) => {
  const resolved = environmentSettings?.[key];

  return resolved === undefined ? undefined : String(resolved);
};

const configuredByOf = (
  integration: Integration,
  stored: StoredSettings,
  environmentVariant: IntegrationVariant | null
) => {
  if (environmentVariant !== null) {
    return "environment" as const;
  }

  return stored[integration.discriminantKey] === undefined
    ? null
    : ("instance" as const);
};

const describeIntegration = (
  integration: Integration,
  stored: StoredSettings
) => {
  const environmentVariant = environmentVariantOf(
    integration,
    stored,
    heldInEnvironment,
    environmentOwns
  );

  const selectedVariantId =
    environmentVariant?.id ?? selectedVariantOf(integration, stored);

  return {
    configuredBy: configuredByOf(integration, stored, environmentVariant),
    discriminantKey: integration.discriminantKey,
    discriminantSource: sourceFor(integration.discriminantKey, stored),
    id: integration.id,
    requiredForSetup: isRequiredForSetup(integration),
    selectedVariantId,
    shownInSetup: isShownInSetup(integration),
    state: integrationStateOf(
      integration,
      selectedVariantId,
      (key) => heldValue(key, stored) !== null
    ),
    variants: integration.variants.flatMap((variant) =>
      isListedFor(variant, selectedVariantId)
        ? [
            {
              fields: variant.fields.map((field) =>
                describeField(field, stored, variant.id === selectedVariantId)
              ),
              id: variant.id,
              legacy: variant.listedOnlyWhenSelected === true,
              recommended: variant.recommended === true,
            },
          ]
        : []
    ),
  };
};

const hasUnappliedChange = (stored: StoredSettings): boolean => {
  const loaded = storedSettingsAtBoot();

  for (const key of instanceConfigurableKeys) {
    if (!environmentOwns(key) && stored[key] !== loaded[key]) {
      return true;
    }
  }

  return false;
};

const integrationInput = z.object({
  integrationId: z.string(),
  values: z.record(z.string(), z.string()),
  variantId: z.string(),
});

type IntegrationRequest = z.infer<typeof integrationInput>;

const classifierChainFault = (
  validated: ServerSettings
): Option.Option<string> =>
  Option.map(
    Result.getFailure(createClassifierChain(classifierSettingsOf(validated))),
    (unavailable) => unavailable.message
  );

const prepareIntegration = async (request: IntegrationRequest) => {
  const integration = Option.getOrThrowWith(
    findIntegration(request.integrationId),
    () => new ORPCError("NOT_FOUND", { message: "Unknown integration" })
  );

  const variant = Option.getOrThrowWith(
    findVariant(integration, request.variantId),
    () => new ORPCError("NOT_FOUND", { message: "Unknown variant" })
  );

  const conflicts = conflictingPresetsOf(
    integration,
    variant,
    heldInEnvironment,
    environmentOwns
  );

  if (conflicts.length > 0) {
    return {
      kind: "refused" as const,
      refusal: { keys: conflicts, outcome: "environment-owned" as const },
    };
  }

  const stored = await readCurrentSettings();
  const candidate = candidateOf(
    integration,
    variant,
    request.values,
    stored,
    environmentOwns,
    selectedVariantOf(integration, stored) === variant.id
  );

  const missing = missingKeysOf(variant, candidate, environmentOwns);

  if (missing.length > 0) {
    return {
      kind: "refused" as const,
      refusal: { keys: missing, outcome: "missing-fields" as const },
    };
  }

  const validated = validateSettings(candidate);

  if (Result.isFailure(validated)) {
    return {
      kind: "refused" as const,
      refusal: {
        detail: validated.failure.detail,
        outcome: "invalid" as const,
      },
    };
  }

  const chainFault = classifierChainFault(validated.success);

  if (Option.isSome(chainFault)) {
    return {
      kind: "refused" as const,
      refusal: { detail: chainFault.value, outcome: "invalid" as const },
    };
  }

  return {
    candidate,
    integration,
    kind: "ready" as const,
    validated: validated.success,
    variant,
  };
};

export const instanceRouter = {
  bankConnectionCount,
  check: operatorProcedure
    .input(integrationInput)
    .handler(async ({ input }) => {
      const prepared = await prepareIntegration(input);

      if (prepared.kind === "refused") {
        return prepared.refusal;
      }

      const probe = Option.getOrThrowWith(
        findProbe(prepared.integration.id, prepared.variant.id),
        () => new ORPCError("NOT_IMPLEMENTED", { message: "No check exists" })
      );

      const probed = await Effect.runPromise(
        Effect.result(probe(prepared.validated))
      );

      if (Result.isFailure(probed)) {
        const { reason } = probed.failure;

        return {
          detail: capProbeDetail(reason.detail),
          outcome: "probe-failed" as const,
          reason: reason.kind,
          status: reason.kind === "rejected" ? reason.status : null,
        };
      }

      return { outcome: "verified" as const };
    }),

  complete: operatorProcedure.handler(async () => {
    const stored = await readCurrentSettings();
    const missing = missingForSetup(
      integrations.map((integration) =>
        describeIntegration(integration, stored)
      )
    );

    if (missing.length > 0) {
      throw new ORPCError("PRECONDITION_FAILED", {
        data: { missing },
        message: "Configure a bank provider before finishing setup",
      });
    }

    await Effect.runPromise(markSetupComplete());

    const restarting = hasUnappliedChange(stored);

    if (restarting) {
      setTimeout(() => process.exit(0), RESTART_GRACE_MS);
    }

    return { completed: true as const, restarting };
  }),

  describe: operatorProcedure.handler(async () => {
    const stored = await readCurrentSettings();

    return {
      fault: Option.match(instanceConfigFault, {
        onNone: () => null,
        onSome: (rejected) => rejected.detail,
      }),
      integrations: integrations.map((integration) =>
        describeIntegration(integration, stored)
      ),
      restartRequired: hasUnappliedChange(stored),
    };
  }),

  save: operatorProcedure
    .input(integrationInput)
    .handler(async ({ context, input }) => {
      const prepared = await prepareIntegration(input);

      if (prepared.kind === "refused") {
        return prepared.refusal;
      }

      if (
        isWhollyOwnedByEnvironment(
          prepared.integration,
          prepared.variant,
          environmentOwns
        )
      ) {
        return { outcome: "nothing-to-save" as const };
      }

      await Effect.runPromise(
        writeStoredSettings(
          settings.BETTER_AUTH_SECRET,
          writesOf(prepared.integration, prepared.candidate, environmentOwns),
          context.session.user.id
        )
      );

      return { outcome: "saved" as const, restartRequired: true };
    }),

  status: publicProcedure.handler(async ({ context }) => {
    const state = await Effect.runPromise(readSetupState());
    const userId = context.session?.user.id;
    const operator = userId === undefined ? false : await isOperator(userId);

    return { ...state, isOperator: operator };
  }),

  update: protectedProcedure.handler(async ({ context }) =>
    visibleTo(updateCheck.status(), await isOperator(context.session.user.id))
  ),
};
