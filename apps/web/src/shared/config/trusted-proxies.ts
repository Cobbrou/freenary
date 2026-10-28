import { processEnv } from "./process-env";

export const getTrustedProxies = (): string[] =>
  (processEnv?.TRUSTED_PROXIES ?? "").split(",").flatMap((entry) => {
    const trimmed = entry.trim();

    return trimmed.length > 0 ? [trimmed] : [];
  });
