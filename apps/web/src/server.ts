import handler from "@tanstack/react-start/server-entry";

import { paraglideMiddleware } from "@/paraglide/server.js";
import { forwardApiRequest } from "@/shared/lib/forward-api-request";

const LOCALE_VARY_HEADERS = "Accept-Language, Cookie";

const SECURITY_HEADERS = {
  "Content-Security-Policy": "frame-ancestors 'none'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
} as const;

const PAGE_SECURITY_HEADERS = {
  ...SECURITY_HEADERS,
  "Content-Security-Policy":
    "img-src 'self' data: blob: https://enablebanking.com; frame-ancestors 'none'",
} as const;

const withHeaders = (
  response: Response,
  headers: Record<string, string>
): Response => {
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }

  return response;
};

export default {
  fetch: async (request: Request): Promise<Response> => {
    const forwarded = forwardApiRequest(request);

    if (forwarded) {
      return withHeaders(await forwarded, SECURITY_HEADERS);
    }

    const response = await paraglideMiddleware(request, () =>
      handler.fetch(request)
    );

    const localized = new Response(response.body, response);
    localized.headers.append("Vary", LOCALE_VARY_HEADERS);

    return withHeaders(localized, PAGE_SECURITY_HEADERS);
  },
};
