import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";

import { serverEnvSchema } from "./schema";

export const env = createEnv({
  emptyStringAsUndefined: true,
  onValidationError: (issues) => {
    console.error("Invalid environment variables:");

    for (const { message, path } of issues) {
      const name = String(path?.[0]);
      const description = Object.entries(serverEnvSchema)
        .find(([key]) => key === name)?.[1]
        .meta()?.description;

      console.error(
        `- ${name}: ${message}${description ? ` (${description})` : ""}`
      );
    }

    process.exit(1);
  },
  runtimeEnv: process.env,
  server: serverEnvSchema,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
