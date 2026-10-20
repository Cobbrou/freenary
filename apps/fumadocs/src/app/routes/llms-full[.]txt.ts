import { createFileRoute } from "@tanstack/react-router";

import { getLLMText, newestRelease, source } from "@/shared/content";

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: async () => {
        const newest = newestRelease();
        const scan = source
          .getPages()
          .flatMap((page) =>
            page.slugs[0] === newest ? [getLLMText(page)] : []
          );

        const scanned = await Promise.all(scan);

        return new Response(scanned.join("\n\n"));
      },
    },
  },
});
