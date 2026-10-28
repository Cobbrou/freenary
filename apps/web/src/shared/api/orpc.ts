import type { AppRouter } from "@freenary/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { SimpleCsrfProtectionLinkPlugin } from "@orpc/client/plugins";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";

import { getServerUrl } from "../config/server-url";

interface ForwardedCookieContext {
  cookie?: string;
}

const STALE_TIME_MS = 60 * 1000;

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { staleTime: STALE_TIME_MS } },
    queryCache: new QueryCache({
      onError: (_error, query) => {
        const isUnobservedPrefetch = query.getObserversCount() === 0;

        if (isUnobservedPrefetch) {
          return;
        }

        toast.error(m.query_error_generic(), {
          action: {
            label: m.query_error_retry(),
            onClick: () => {
              query.invalidate();
            },
          },
        });
      },
    }),
  });

const link = new RPCLink<ForwardedCookieContext>({
  fetch(url, options) {
    return fetch(url, {
      ...options,
      credentials: "include",
    });
  },
  headers: ({ context }) =>
    context.cookie === undefined ? {} : { cookie: context.cookie },
  plugins: [new SimpleCsrfProtectionLinkPlugin()],
  url: `${getServerUrl()}/rpc`,
});

// SAFETY: createORPCClient returns a generic client; cast aligns it with the known AppRouter type
const getORPCClient = () =>
  createORPCClient(link) as RouterClient<AppRouter, ForwardedCookieContext>;

export const client: RouterClient<AppRouter, ForwardedCookieContext> =
  getORPCClient();

export const orpc = createTanstackQueryUtils(client);
