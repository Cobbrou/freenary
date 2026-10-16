import handler from "@tanstack/react-start/server-entry";

import { paraglideMiddleware } from "@/paraglide/server.js";
import { forwardApiRequest } from "@/shared/lib/forward-api-request";

const LOCALE_VARY_HEADERS = "Accept-Language, Cookie";

export default {
  fetch: async (request: Request): Promise<Response> => {
    const forwarded = forwardApiRequest(request);

    if (forwarded) {
      return await forwarded;
    }

    const response = await paraglideMiddleware(request, () =>
      handler.fetch(request)
    );

    const localized = new Response(response.body, response);
    localized.headers.append("Vary", LOCALE_VARY_HEADERS);

    return localized;
  },
};
