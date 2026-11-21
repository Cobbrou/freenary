import { createFileRoute } from "@tanstack/react-router";

import {
  getLLMText,
  markdownUrlOf,
  movedPageOf,
  pageAtFile,
  source,
} from "@/shared/content";
import { decodeMarkdownUrl } from "@/shared/lib/markdown-url";

import { notFoundResponse } from "../../api/not-found";

const MARKDOWN_EXTENSION = /\.md$/;

const redirectTo = (location: string) =>
  new Response(null, {
    headers: { Location: location },
    status: 307,
  });

export const Route = createFileRoute("/docs/{$}.md")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const file = (params._splat ?? "").replace(MARKDOWN_EXTENSION, "");
        const page = pageAtFile(`${file}.md`);

        if (page) {
          return new Response(await getLLMText(page), {
            headers: {
              "Content-Type": "text/markdown; charset=utf-8",
            },
          });
        }

        const slugs = decodeMarkdownUrl(file.split("/"));
        const elsewhere = source.getPage(slugs) ?? movedPageOf(slugs.join("/"));

        if (!elsewhere) return notFoundResponse();

        return redirectTo(markdownUrlOf(elsewhere));
      },
    },
  },
});
