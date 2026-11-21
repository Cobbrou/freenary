import { carriesApiKey, requestCredential } from "@freenary/auth";
import type { ResolvedSession } from "@freenary/auth";
import { env } from "@freenary/env/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createRouterClient } from "@orpc/server";
import { Effect } from "effect";

import {
  apiKeyRefusalResponse,
  BEARER_CHALLENGE,
} from "../lib/api-key-refusal";
import { appRouter } from "../routers/index";
import { createFreenaryMcpServer } from "./server";

export const MCP_PATH = "/mcp";

const UNVERSIONED_BUILD = "0.0.0";

const plainRefusal = (
  status: number,
  body: string,
  headers: Record<string, string> = {}
) => new Response(body, { headers, status });

const unauthorized = () =>
  plainRefusal(401, "unauthorized", { "WWW-Authenticate": BEARER_CHALLENGE });

export const refusalBeforeCredential = (
  request: Request,
  allowedOrigin: string
): Response | null => {
  const origin = request.headers.get("origin");

  if (origin !== null && origin !== new URL(allowedOrigin).origin) {
    return plainRefusal(403, "forbidden_origin");
  }

  if (request.method !== "POST") {
    return plainRefusal(405, "method_not_allowed", { Allow: "POST" });
  }

  if (!carriesApiKey(request.headers)) {
    return unauthorized();
  }

  return null;
};

const answerOverMcp = (
  request: Request,
  session: NonNullable<ResolvedSession>
) =>
  Effect.acquireUseRelease(
    Effect.sync(() =>
      createFreenaryMcpServer(
        createRouterClient(appRouter, {
          context: { auth: null, headers: request.headers, session },
        }),
        env.FREENARY_BUILD_VERSION ?? UNVERSIONED_BUILD
      )
    ),
    (server) =>
      Effect.promise(async () => {
        const transport = new WebStandardStreamableHTTPServerTransport({
          enableJsonResponse: true,
          sessionIdGenerator: undefined,
        });

        await server.connect(transport);

        return transport.handleRequest(request);
      }),
    (server) => Effect.promise(() => server.close())
  );

export const handleMcpRequest = async (request: Request): Promise<Response> => {
  const refusal = refusalBeforeCredential(request, env.CORS_ORIGIN);

  if (refusal) {
    return refusal;
  }

  const credential = await requestCredential(request.headers);

  if (credential.kind === "api-key-refused") {
    return apiKeyRefusalResponse(credential.refusal);
  }

  if (!credential.session?.user) {
    return unauthorized();
  }

  return Effect.runPromise(answerOverMcp(request, credential.session));
};
