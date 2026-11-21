import { BrandAvatar } from "@freenary/ui/components/brand-avatar";
import { cn } from "cn";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/docs/page";
import { Suspense, use } from "react";

import { baseOptions, docsSourceUrl } from "@/shared/config";
import { docs } from "@/shared/content";
import {
  AISearch,
  AISearchPanel,
  AISearchTrigger,
} from "@/shared/ui/ai-search";
import { useMDXComponents } from "@/shared/ui/mdx";

import type { LoadedDoc } from "../api/load-doc";

function Content({ path, markdownUrl }: { path: string; markdownUrl: string }) {
  const page = docs.getPage(path);

  if (!page) throw new Error(`unknown page: ${path}`);

  const { toc } = use(page.load());
  const MDX = page.body;

  return (
    <DocsPage toc={toc}>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <div className="-mt-4 flex flex-row items-center gap-2 border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl}
          githubUrl={docsSourceUrl(path)}
        />
      </div>
      <DocsBody>
        <MDX components={useMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export function DocumentationPage({ loaded }: { loaded: LoadedDoc }) {
  const { path, pageTree, markdownUrl } = useFumadocsLoader(loaded);

  return (
    <DocsLayout {...baseOptions()} tree={pageTree}>
      <AISearch>
        <AISearchPanel />
        <AISearchTrigger
          position="float"
          className={cn(
            buttonVariants({
              variant: "secondary",
              className: "text-fd-muted-foreground rounded-2xl",
            })
          )}
        >
          <BrandAvatar aria-hidden size={18} state="idle" />
          Ask AI
        </AISearchTrigger>
      </AISearch>

      <Suspense>
        <Content path={path} markdownUrl={markdownUrl} />
      </Suspense>
    </DocsLayout>
  );
}
