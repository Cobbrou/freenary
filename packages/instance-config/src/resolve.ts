import { env } from "@freenary/env/server";
import { Effect, Result } from "effect";
import type { Option } from "effect";

import type {
  InstanceSettingsRejected,
  ServerSettings,
  StoredSettings,
} from "./candidate";
import { validateSettings } from "./candidate";
import { readStoredSettings } from "./store";

const isProduction = process.env.NODE_ENV === "production";

const loadStoredSettings = async (): Promise<StoredSettings> => {
  const attempt = await Effect.runPromise(
    Effect.result(readStoredSettings(env.BETTER_AUTH_SECRET))
  );

  if (Result.isSuccess(attempt)) {
    return attempt.success;
  }

  if (isProduction) {
    throw attempt.failure;
  }

  console.warn(
    `${attempt.failure.message}. The environment alone is in force.`
  );

  return {};
};

const stored = await loadStoredSettings();

const built = validateSettings(stored);

export const instanceConfigFault: Option.Option<InstanceSettingsRejected> =
  Result.getFailure(built);

export const settings: ServerSettings = Result.getOrElse(built, () => env);

export const storedSettingsAtBoot = (): StoredSettings => stored;
