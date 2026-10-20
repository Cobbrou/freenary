import { serverEnvSchema } from "@freenary/env/schema";
import type { env } from "@freenary/env/server";
import { createEnv } from "@t3-oss/env-core";
import { Data, Result } from "effect";

import { instanceConfigurableKeys } from "./integrations";
import type { ServerSettingKey } from "./integrations";

export type ServerSettings = typeof env;

export type StoredSettings = Readonly<Record<string, string>>;

export type SettingSource = "environment" | "instance" | "unset";

export class InstanceSettingsRejected extends Data.TaggedError(
  "InstanceSettingsRejected"
)<{
  readonly detail: string;
}> {
  override get message(): string {
    return `The instance configuration does not validate: ${this.detail}`;
  }
}

export const environmentOwns = (key: ServerSettingKey): boolean => {
  const declared = process.env[key];

  return declared !== undefined && declared !== "";
};

const overlayOf = (stored: StoredSettings): Record<string, string> => {
  const overlay: Record<string, string> = {};

  for (const key of instanceConfigurableKeys) {
    const supplied = stored[key];

    if (supplied !== undefined && !environmentOwns(key)) {
      overlay[key] = supplied;
    }
  }

  return overlay;
};

export const validateSettings = (
  stored: StoredSettings
): Result.Result<ServerSettings, InstanceSettingsRejected> =>
  Result.try({
    catch: (cause) => new InstanceSettingsRejected({ detail: String(cause) }),
    try: () =>
      createEnv({
        emptyStringAsUndefined: true,
        runtimeEnv: { ...process.env, ...overlayOf(stored) },
        server: serverEnvSchema,
        skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
      }),
  });
