import { createFileRoute } from "@tanstack/react-router";

import { llmsIndex, withAbsoluteLlmsLinks } from "@/shared/content";

import { notFoundResponse } from "../api/not-found";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET({ request }) {
        if (llmsIndex === undefined) return notFoundResponse();

        return new Response(
          withAbsoluteLlmsLinks(llmsIndex, new URL(request.url).origin),
          { headers: { "Content-Type": "text/plain; charset=utf-8" } }
        );
      },
    },
  },
});
