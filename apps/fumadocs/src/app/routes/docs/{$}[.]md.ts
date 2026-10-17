import { createFileRoute, notFound } from "@tanstack/react-router";

import { findMovedPage, getLLMText, source } from "@/shared/content";
import {
  decodeMarkdownUrl,
  encodeMarkdownUrl,
} from "@/shared/lib/markdown-url";

export const Route = createFileRoute("/docs/{$}.md")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slugs = decodeMarkdownUrl(params._splat?.split("/") ?? []);
        const page = source.getPage(slugs);

        if (!page) {
          const moved = findMovedPage(slugs);

          if (!moved) throw notFound();

          return new Response(null, {
            headers: {
              Location: encodeMarkdownUrl(moved.slugs, moved.locale),
            },
            status: 307,
          });
        }

        return new Response(await getLLMText(page), {
          headers: {
            "Content-Type": "text/markdown",
          },
        });
      },
    },
  },
});
