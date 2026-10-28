// SAFETY: globalThis may carry a Node-style process.env; the cast only widens it to that optional shape
export const processEnv = (
  globalThis as { process?: { env?: Record<string, string | undefined> } }
).process?.env;
