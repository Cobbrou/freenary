import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { ElementContent, Root, RootContent } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactNode,
  Suspense,
  use,
  useDeferredValue,
} from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import { visit } from "unist-util-visit";
import { z } from "zod";

export interface Processor {
  process: (content: string) => Promise<ReactNode>;
}

const BEFORE_WHITESPACE = /(?=\s)/;

const LANGUAGE_CLASS_PREFIX = "language-";

const FALLBACK_LANGUAGE = "text";

const MDX_LANGUAGE = "mdx";

const MDX_SHIKI_LANGUAGE = "md";

const codeText = z.string();

const processor = createProcessor();

const renderedByText = new Map<string, Promise<ReactNode>>();

export function rehypeWrapWords() {
  return (tree: Root) => {
    visit(tree, ["text", "element"], (node, index, parent) => {
      if (node.type === "element" && node.tagName === "pre") return "skip";

      if (node.type !== "text" || !parent || index === undefined) return;

      const words = node.value.split(BEFORE_WHITESPACE);

      const wordSpans: ElementContent[] = words.flatMap((word) => {
        if (word.length === 0) return [];

        return {
          type: "element",
          tagName: "span",
          properties: {
            class: "animate-fd-fade-in",
          },
          children: [{ type: "text", value: word }],
        };
      });

      Object.assign(node, {
        type: "element",
        tagName: "span",
        properties: {},
        children: wordSpans,
      } satisfies RootContent);

      return "skip";
    });
  };
}

function createProcessor(): Processor {
  const remarkProcessor = remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeWrapWords);

  return {
    async process(content) {
      const nodes = remarkProcessor.parse({ value: content });
      const hast = await remarkProcessor.run(nodes);

      return toJsxRuntime(hast, {
        development: false,
        jsx,
        jsxs,
        Fragment,
        components: {
          ...defaultMdxComponents,
          pre: Pre,
          img: undefined,
        },
      });
    },
  };
}

function languageOf(className: string | undefined) {
  const declared =
    className
      ?.split(" ")
      .find((value) => value.startsWith(LANGUAGE_CLASS_PREFIX))
      ?.slice(LANGUAGE_CLASS_PREFIX.length) ?? FALLBACK_LANGUAGE;

  return declared === MDX_LANGUAGE ? MDX_SHIKI_LANGUAGE : declared;
}

function Pre(props: ComponentProps<"pre">) {
  const code = Children.only(props.children);

  if (!isValidElement<ComponentProps<"code">>(code)) return null;

  const content = codeText.safeParse(code.props.children);

  if (!content.success) return null;

  return (
    <DynamicCodeBlock
      lang={languageOf(code.props.className)}
      code={content.data.trimEnd()}
    />
  );
}

export function Markdown({ text }: { text: string }) {
  const deferredText = useDeferredValue(text);

  return (
    <Suspense fallback={<p className="invisible">{text}</p>}>
      <Renderer text={deferredText} />
    </Suspense>
  );
}

function Renderer({ text }: { text: string }) {
  const rendered = renderedByText.get(text) ?? processor.process(text);
  renderedByText.set(text, rendered);

  return use(rendered);
}
