import { cors } from "@elysiajs/cors";
import { createContext } from "@freenary/api/context";
import { exchangeRateRefresh } from "@freenary/api/fx/rates";
import { updateCheck } from "@freenary/api/instance/update-check";
import { refusedApiKeyResponse } from "@freenary/api/lib/api-key-refusal";
import { sealLegacyProviderTokens } from "@freenary/api/lib/bank-provider-user";
import { isJsonRequest } from "@freenary/api/lib/json-request";
import {
  handleMockConsent,
  MOCK_CONSENT_PATH,
} from "@freenary/api/providers/mock/consent";
import { appRouter } from "@freenary/api/routers/index";
import { auth, requestSession } from "@freenary/auth";
import { env } from "@freenary/env/server";
import { readSetupState } from "@freenary/instance-config";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { SimpleCsrfProtectionHandlerPlugin } from "@orpc/server/plugins";
import { Effect } from "effect";
import { Elysia } from "elysia";
import { initLogger } from "evlog";
import { createAuthMiddleware } from "evlog/better-auth";
import { evlog } from "evlog/elysia";
import { createFsDrain } from "evlog/fs";

const SERVER_ERROR_STATUS = 500;

const isCallerRefusal = (error: ORPCError<string, unknown>) =>
  error.status < SERVER_ERROR_STATUS;

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    // eslint-disable-next-line promise/prefer-await-to-callbacks -- oRPC interceptor API uses callback pattern
    onError((error) => {
      if (!(error instanceof ORPCError && isCallerRefusal(error))) {
        console.error(error);
      }
    }),
  ],
  plugins: [new SimpleCsrfProtectionHandlerPlugin()],
});

const createApiHandler = async () => {
  const [
    { OpenAPIHandler },
    { OpenAPIReferencePlugin },
    { ZodToJsonSchemaConverter },
  ] = await Promise.all([
    import("@orpc/openapi/fetch"),
    import("@orpc/openapi/plugins"),
    import("@orpc/zod/zod4"),
  ]);

  return new OpenAPIHandler(appRouter, {
    interceptors: [
      // eslint-disable-next-line promise/prefer-await-to-callbacks -- oRPC interceptor API uses callback pattern
      onError((error) => {
        if (!(error instanceof ORPCError && isCallerRefusal(error))) {
          console.error(error);
        }
      }),
    ],
    plugins: [
      new OpenAPIReferencePlugin({
        schemaConverters: [new ZodToJsonSchemaConverter()],
      }),
    ],
  });
};

let apiHandler: ReturnType<typeof createApiHandler> | null = null;

const openApiHandler = () => {
  apiHandler ??= createApiHandler();

  return apiHandler;
};

const copyResponseStatusOntoWideEvent = (
  set: { status?: number | string },
  response: Response
) => {
  set.status = response.status;

  return response;
};

initLogger({
  env: { service: "freenary-server" },
});

const SURFACES_THAT_ANSWER_AN_API_KEY = ["/rpc", "/api-reference", "/ai/chat"];

const answersAnApiKey = (pathname: string) =>
  SURFACES_THAT_ANSWER_AN_API_KEY.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

const sessionResolvedOncePerRequest = {
  api: {
    getSession: ({ headers }: { headers: Headers }) => requestSession(headers),
  },
};

const identifyUser = createAuthMiddleware(sessionResolvedOncePerRequest, {
  exclude: ["/api/auth/**"],
  maskEmail: true,
});

new Elysia()
  .use(
    evlog({
      drain:
        process.env.NODE_ENV === "production" ? undefined : createFsDrain(),
    })
  )
  .derive(async ({ request, log }) => {
    await identifyUser(log, request.headers, new URL(request.url).pathname);

    return {};
  })
  .onBeforeHandle(async ({ request, set }) => {
    if (!answersAnApiKey(new URL(request.url).pathname)) {
      return;
    }

    const refusal = await refusedApiKeyResponse(request.headers);

    if (refusal) {
      return copyResponseStatusOntoWideEvent(set, refusal);
    }
  })
  .use(
    cors({
      allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      origin: env.CORS_ORIGIN,
    })
  )
  .all("/api/auth/*", async (context) => {
    const { request, set, status } = context;

    if (["POST", "GET"].includes(request.method)) {
      return copyResponseStatusOntoWideEvent(set, await auth.handler(request));
    }

    return status(405);
  })
  .all(
    "/rpc*",
    async (context) => {
      const { response } = await rpcHandler.handle(context.request, {
        context: await createContext({ context }),
        prefix: "/rpc",
      });

      return copyResponseStatusOntoWideEvent(
        context.set,
        response ?? new Response("Not Found", { status: 404 })
      );
    },
    {
      parse: "none",
    }
  )
  .post(
    "/ai/chat",
    async (context) => {
      const { handleAssistantChat } =
        await import("@freenary/api/assistant/handler");

      return handleAssistantChat({
        log: context.log,
        request: context.request,
      });
    },
    {
      parse: "none",
    }
  )
  .all(
    "/mcp",
    async (context) => {
      const { handleMcpRequest } = await import("@freenary/api/mcp/handler");

      return copyResponseStatusOntoWideEvent(
        context.set,
        await handleMcpRequest(context.request)
      );
    },
    {
      parse: "none",
    }
  )
  .all(
    "/api-reference*",
    async (context) => {
      if (
        context.request.method === "POST" &&
        !isJsonRequest(context.request)
      ) {
        return copyResponseStatusOntoWideEvent(
          context.set,
          new Response("unsupported_media_type", { status: 415 })
        );
      }

      const { pathname, search } = new URL(context.request.url);
      const publicRequest = new Request(
        new URL(`${pathname}${search}`, env.BETTER_AUTH_URL).href,
        context.request
      );

      const handler = await openApiHandler();
      const { response } = await handler.handle(publicRequest, {
        context: await createContext({ context }),
        prefix: "/api-reference",
      });

      return copyResponseStatusOntoWideEvent(
        context.set,
        response ?? new Response("Not Found", { status: 404 })
      );
    },
    {
      parse: "none",
    }
  )
  .get(MOCK_CONSENT_PATH, (context) => handleMockConsent(context.request))
  .get("/", () => "OK")
  .listen(env.PORT, () => {
    console.log(`Server is running on ${env.BETTER_AUTH_URL}`);
  });

updateCheck.start();

exchangeRateRefresh.start();

if (
  process.env.NODE_ENV === "production" &&
  (env.TRUSTED_PROXIES ?? []).length === 0
) {
  console.warn(
    "TRUSTED_PROXIES is not set. If a reverse proxy sits in front of the web app, every visitor counts as the proxy's address and shares one sign-in rate limit: set TRUSTED_PROXIES to the proxy's address or range."
  );
}

await sealLegacyProviderTokens();

const setupState = await Effect.runPromise(readSetupState());

const unclaimedNotice =
  env.SETUP_TOKEN === undefined
    ? `This instance has no operator yet. The first account to sign in at ${env.CORS_ORIGIN} becomes the operator.`
    : `This instance has no operator yet. Sign in at ${env.CORS_ORIGIN} and enter SETUP_TOKEN on the setup screen to become the operator.`;

if (!setupState.claimed) {
  console.log(unclaimedNotice);
}
