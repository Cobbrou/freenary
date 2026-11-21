import { usePathname } from "fumadocs-core/framework";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

import { pageUrlOfLinkAt } from "../content";

const BaseLink = defaultMdxComponents.a;

const RelativeLink = ({ href, ...props }: ComponentProps<typeof BaseLink>) => {
  const pathname = usePathname();

  return (
    <BaseLink
      href={href === undefined ? href : pageUrlOfLinkAt(href, pathname)}
      {...props}
    />
  );
};

const extraMdxComponents = {
  a: RelativeLink,
};

export const getMDXComponents = (
  components: MDXComponents = {}
): MDXComponents => ({
  ...defaultMdxComponents,
  ...extraMdxComponents,
  ...components,
});

export const useMDXComponents = getMDXComponents;

export type DocsMdxComponents = typeof defaultMdxComponents &
  typeof extraMdxComponents;

declare global {
  type MDXProvidedComponents = DocsMdxComponents;
}
