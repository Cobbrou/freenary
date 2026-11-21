import { createFileRoute } from "@tanstack/react-router";

import { llmsIndex } from "@/shared/content";

import { notFoundResponse } from "../../api/not-found";

export const Route = createFileRoute("/docs/llms.txt")({
  server: {
    handlers: {
      GET() {
        if (llmsIndex === undefined) return notFoundResponse();

        return new Response(llmsIndex, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
