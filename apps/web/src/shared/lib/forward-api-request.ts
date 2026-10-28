import { getIPFromHeader } from "@better-auth/core/utils/ip";
import { Data, Effect } from "effect";
import type { Duration } from "effect";
import { z } from "zod";

import { getInternalServerUrl, getTrustedProxies } from "@/shared/config";

export const FORWARDED_PATH_PREFIXES = [
  "/api/auth",
  "/rpc",
  "/ai/chat",
  "/api-reference",
] as const;

const DROPPED_REQUEST_HEADERS = [
  "connection",
  "host",
  "keep-alive",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "x-forwarded-for",
] as const;

const HEADERS_FETCH_INVALIDATES = ["content-encoding", "content-length"];

const BAD_GATEWAY = 502;
const CLIENT_CLOSED_REQUEST = 499;
const UPSTREAM_ANSWER_TIMEOUT: Duration.Input = "9 seconds";

const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

class ForwardFailed extends Data.TaggedError("ForwardFailed")<{
  readonly callerLeft: boolean;
  readonly reason: string;
  readonly target: string;
}> {}

export const isForwardedPath = (pathname: string): boolean =>
  FORWARDED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

const peerAddressShape = z.object({ ip: z.string().min(1) });

const resolveCallerAddress = (request: Request): string | null => {
  const peer = peerAddressShape.safeParse(request);

  if (!peer.success) {
    return null;
  }

  const trustedProxies = getTrustedProxies();

  if (trustedProxies.length === 0) {
    return peer.data.ip;
  }

  const chain = [request.headers.get("x-forwarded-for"), peer.data.ip]
    .filter(Boolean)
    .join(",");

  return getIPFromHeader(chain, { trustedProxies });
};

const buildForwardedRequestInit = (
  request: Request,
  signal: AbortSignal
): RequestInit & { duplex?: "half" } => {
  const headers = new Headers(request.headers);

  for (const name of DROPPED_REQUEST_HEADERS) {
    headers.delete(name);
  }

  const callerAddress = resolveCallerAddress(request);

  if (callerAddress) {
    headers.set("x-forwarded-for", callerAddress);
  }

  headers.set("accept-encoding", "identity");

  const carriesBody = !BODYLESS_METHODS.has(request.method);

  return {
    body: carriesBody ? request.body : undefined,
    duplex: carriesBody ? "half" : undefined,
    headers,
    method: request.method,
    redirect: "manual",
    signal,
  };
};

const withDecodedBodyHeaders = (upstream: Response): Response => {
  const headers = new Headers(upstream.headers);

  for (const name of HEADERS_FETCH_INVALIDATES) {
    headers.delete(name);
  }

  return new Response(upstream.body, {
    headers,
    status: upstream.status,
    statusText: upstream.statusText,
  });
};

const fetchFailureShape = z.object({
  code: z.string().optional(),
  name: z.string(),
});

const describeFetchFailure = (cause: unknown): string => {
  const parsed = fetchFailureShape.safeParse(cause);

  if (!parsed.success) {
    return "unknown failure";
  }

  return [parsed.data.name, parsed.data.code].filter(Boolean).join(" ");
};

const forwardTo = (
  request: Request,
  apiOrigin: string,
  answerTimeout: Duration.Input
) => {
  const incoming = new URL(request.url);
  const loggedTarget = `${apiOrigin}${incoming.pathname}`;
  const target = `${loggedTarget}${incoming.search}`;

  return Effect.tryPromise({
    catch: (cause) =>
      new ForwardFailed({
        callerLeft: request.signal.aborted,
        reason: describeFetchFailure(cause),
        target: loggedTarget,
      }),
    try: (timeoutSignal) =>
      fetch(
        target,
        buildForwardedRequestInit(
          request,
          AbortSignal.any([request.signal, timeoutSignal])
        )
      ),
  }).pipe(
    Effect.timeoutOrElse({
      duration: answerTimeout,
      orElse: () =>
        Effect.fail(
          new ForwardFailed({
            callerLeft: false,
            reason: `no answer within ${String(answerTimeout)}`,
            target: loggedTarget,
          })
        ),
    }),
    Effect.map(withDecodedBodyHeaders),
    Effect.catchTag("ForwardFailed", (failure) =>
      failure.callerLeft
        ? Effect.logDebug(
            `The caller closed the request to ${failure.target}`
          ).pipe(
            Effect.as(new Response(null, { status: CLIENT_CLOSED_REQUEST }))
          )
        : Effect.logWarning(
            `The API server at ${failure.target} did not answer: ${failure.reason}`
          ).pipe(
            Effect.as(new Response("Bad Gateway", { status: BAD_GATEWAY }))
          )
    )
  );
};

export const forwardApiRequest = (
  request: Request,
  answerTimeout: Duration.Input = UPSTREAM_ANSWER_TIMEOUT
): Promise<Response> | undefined => {
  const apiOrigin = getInternalServerUrl();

  if (!(apiOrigin && isForwardedPath(new URL(request.url).pathname))) {
    return undefined;
  }

  return Effect.runPromise(forwardTo(request, apiOrigin, answerTimeout));
};
