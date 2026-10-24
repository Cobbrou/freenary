const MILLISECONDS_PER_SECOND = 1000;
const TIMEOUT_ERROR = "TimeoutError";
const TIMEOUT_VARIABLE = "TRANSACTION_CLASSIFIER_TIMEOUT_MS";

const isTimeout = (cause: unknown): boolean =>
  cause instanceof Error && cause.name === TIMEOUT_ERROR;

export const unreachableDetail = (cause: unknown, timeoutMs: number): string =>
  isTimeout(cause)
    ? `no answer within ${timeoutMs / MILLISECONDS_PER_SECOND} s. Raise ${TIMEOUT_VARIABLE} to wait longer.`
    : String(cause);

export const endpointHeaders = (apiKey: string | undefined): Headers => {
  const headers = new Headers({ "Content-Type": "application/json" });

  if (apiKey !== undefined && apiKey.length > 0) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }

  return headers;
};
