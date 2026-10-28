import { cors } from "@elysiajs/cors";
import { handleAssistantChat } from "@freenary/api/assistant/handler";
import { createContext } from "@freenary/api/context";
import { updateCheck } from "@freenary/api/instance/update-check";
import {
  handleMockConsent,
  MOCK_CONSENT_PATH,
} from "@freenary/api/providers/mock/consent";
import { appRouter } from "@freenary/api/routers/index";
import { auth } from "@freenary/auth";
import { env } from "@freenary/env/server";
import { readSetupState } from "@freenary/instance-config";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { SimpleCsrfProtectionHandlerPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Effect } from "effect";
import { Elysia } from "elysia";
import { initLogger } from "evlog";
import { createAuthMiddleware } from "evlog/better-auth";
import type { BetterAuthInstance } from "evlog/better-auth";
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

const apiHandler = new OpenAPIHandler(appRouter, {
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

// SAFETY: auth is created by better-auth which satisfies BetterAuthInstance; cast needed for evlog middleware typing
const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
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
    (context) =>
      handleAssistantChat({ log: context.log, request: context.request }),
    {
      parse: "none",
    }
  )
  .all(
    "/api-reference*",
    async (context) => {
      const { pathname, search } = new URL(context.request.url);
      const publicRequest = new Request(
        new URL(`${pathname}${search}`, env.BETTER_AUTH_URL).href,
        context.request
      );

      const { response } = await apiHandler.handle(publicRequest, {
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

const setupState = await Effect.runPromise(readSetupState());

if (!setupState.claimed) {
  console.log(
    `This instance has no operator yet. The first account to sign in at ${env.CORS_ORIGIN} becomes the operator.`
  );
}
