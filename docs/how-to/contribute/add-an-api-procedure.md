---
title: Add an API procedure
description: Write an oRPC procedure, register it, call it from the web app and regenerate the API reference.
---

This page helps you add a procedure to the API: a typed function the web app calls over oRPC (the RPC library the API is built on). You write it in `packages/api`, register it in `appRouter`, call it from `apps/web`, and regenerate the [API](../../reference/api.md) reference.

## Before you start

- A working clone, as in [Run from source](run-from-source.md).
- The three procedure builders, exported by `packages/api/src/index.ts`:
  - `publicProcedure`: no session needed.
  - `protectedProcedure`: needs a session. Without one it throws `ORPCError("UNAUTHORIZED")`. In the handler, `context.session.user.id` is the signed-in user.
  - `operatorProcedure`: needs the session of the operator account (`role` `OPERATOR` in the `user` table). Without a session it throws `UNAUTHORIZED`, with another account `FORBIDDEN`.
- The routers are in `packages/api/src/routers/`, one file per area (`budget.ts`, `dashboards.ts`, `settings.ts` and others). Each exports a plain object of procedures, such as `dashboardsRouter`.

## Steps

1. Add the procedure to the router of its area. Declare the input with Zod, then write the handler. This example adds `rename` to `packages/api/src/routers/dashboards.ts`:

   ```ts
   import prisma from "@freenary/db";
   import { ORPCError } from "@orpc/server";
   import { z } from "zod";

   import { protectedProcedure } from "../index";

   export const dashboardsRouter = {
     rename: protectedProcedure
       .input(z.object({ dashboardId: z.string().max(64), title: z.string() }))
       .handler(async ({ context, input }) => {
         const { count } = await prisma.dashboard.updateMany({
           data: { title: input.title },
           where: { id: input.dashboardId, userId: context.session.user.id },
         });

         if (count === 0) {
           throw new ORPCError("NOT_FOUND", { message: "Dashboard not found" });
         }

         return { ok: true };
       }),
   };
   ```

   Keys of the router object stay in alphabetical order (the lint enforces `sort-keys`). A procedure with no input skips `.input()`, like `list: protectedProcedure.handler(...)`.

2. Refuse a call with `throw new ORPCError(code, { message })`. The routers use the codes `BAD_REQUEST`, `NOT_FOUND`, `CONFLICT`, `PRECONDITION_FAILED`, `TOO_MANY_REQUESTS`, `FORBIDDEN`, `UNAUTHORIZED`, `SERVICE_UNAVAILABLE` and `NOT_IMPLEMENTED`. The API server logs an error only when its status is 500 or above (`isCallerRefusal` in `apps/server/src/index.ts`).

3. For a new area, create `packages/api/src/routers/<area>.ts` and register its router in `appRouter`, in `packages/api/src/routers/index.ts`:

   ```ts
   export const appRouter = {
     // ...
     example: exampleRouter,
   };
   ```

   A procedure `a.b` answers at `/rpc/a/b`. `AppRouter` and `AppRouterClient` are inferred from `appRouter`, so the web client sees the new procedure with no other change.

4. Call it from `apps/web` through `orpc` (TanStack Query helpers) or `client` (the plain oRPC client), both exported by `@/shared/api`:

   ```ts
   import { useMutation, useQueryClient } from "@tanstack/react-query";

   import { orpc } from "@/shared/api";

   const queryClient = useQueryClient();

   const rename = useMutation(
     orpc.dashboards.rename.mutationOptions({
       onSuccess: () =>
         queryClient.invalidateQueries({ queryKey: orpc.dashboards.key() }),
     })
   );
   ```

   Read with `useQuery(orpc.<area>.<procedure>.queryOptions({ input }))`. Query options shared by several slices sit in `entities/<entity>/api/`, such as `entities/dashboard/api/dashboard-queries.ts`. See [Data fetching in apps/web](../../reference/code-conventions.md#data-fetching-in-appsweb) for the defaults the query client applies.

5. Add the interface text of the new screen or button to both `apps/web/messages/en.json` and `apps/web/messages/fr.json`.

6. Write a test next to the router, named `<file>.test.ts`. Call the procedure with `call` from `@orpc/server` and a `Context` you build in the test. Module mocking is refused by the lint (`oxslop/no-module-mocking`), so `packages/api/src/routers/bank-connection-count.ts` takes its database and operator lookups as arguments (`bankConnectionCountWith`), and its test passes fakes:

   ```ts
   const refused = call(bankConnectionCount, undefined, {
     context: contextOf("member"),
   });

   await expect(refused).rejects.toMatchObject({ code: "FORBIDDEN" });
   ```

7. Regenerate the API reference:

   ```bash
   bun run docs:generate
   ```

   It rewrites `docs/reference/api.md` and `docs/reference/openapi.json` from `appRouter`. The `docs-reference` pre-commit hook runs it for you when a file under `packages/api/src/` is staged.

## Check that it works

1. Run your test from `packages/api`, the folder CI runs `bun test` in:

   ```bash
   cd packages/api && bun test src/routers/<file>.test.ts
   ```

   ```text
    2 pass
    0 fail
   ```

2. Check that the reference is current:

   ```bash
   bun scripts/docs-reference.ts --check
   ```

   ```text
   docs-reference: 4 generated files current
   ```

   Your procedure has a row in its section of [API](../../reference/api.md), with its HTTP route `POST /api-reference/<area>/<procedure>` and its access.

3. Run `bun run check-types`. A web call whose input does not match the Zod schema fails here.

## If something goes wrong

`bun run docs:generate` prints each problem as `docs-reference: <message>`:

- `<path>: its middlewares match none of publicProcedure, protectedProcedure or operatorProcedure in …` → build the procedure from one of the three exported builders.
- `<path>: a lazy router, which scripts/docs-reference.ts does not load.` → register the router object itself in `appRouter`, not a lazy import.
- ``<file>: stale. Run `bun run docs:generate`.`` (from `--check` or `bun run docs:check`) → run `bun run docs:generate` and commit the result.

In the web app, a failed query shows a toast with a retry action, and a failed mutation shows a generic toast unless the mutation has its own `onError` or `meta: { errorShownInline: true }`.

## Related

- [API](../../reference/api.md)
- [Code conventions](../../reference/code-conventions.md)
- [Architecture](../../explanation/architecture.md)
