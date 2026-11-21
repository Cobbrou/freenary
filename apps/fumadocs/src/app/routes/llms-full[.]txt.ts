import { createFileRoute } from "@tanstack/react-router";
import { flattenTree } from "fumadocs-core/page-tree";

import { getLLMText, source } from "@/shared/content";

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: async () => {
        const pages = flattenTree(source.getPageTree().children).flatMap(
          (item) => source.getNodePage(item) ?? []
        );

        const texts = await Promise.all(pages.map(getLLMText));

        return new Response(texts.join("\n"), {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
