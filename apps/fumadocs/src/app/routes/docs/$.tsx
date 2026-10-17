import { createFileRoute } from "@tanstack/react-router";

import { DocumentationPage, loadDoc } from "@/pages/docs";
import { appName } from "@/shared/config";
import { docs } from "@/shared/content";

const DocsRoute = () => <DocumentationPage loaded={Route.useLoaderData()} />;

export const Route = createFileRoute("/docs/$")({
  component: DocsRoute,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/") ?? [];
    const loaded = await loadDoc({ data: slugs });
    await docs.getPage(loaded.path)?.preload();

    return loaded;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} | ${appName}` },
          { name: "description", content: loaderData.description },
        ]
      : [],
  }),
});
