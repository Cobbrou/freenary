import { cn } from "@freenary/ui/lib/utils";
import type { ReactNode } from "react";
import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AssistantProseProps {
  children: string;
  className?: string;
}

const markdownComponents = {
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a href={href} rel="noopener noreferrer" target="_blank">
      {children}
    </a>
  ),
};

const DISALLOWED_ELEMENTS = ["img"];

const AssistantProseBody = ({ children, className }: AssistantProseProps) => (
  <div className={cn("min-w-0", className)} data-slot="assistant-prose">
    <Markdown
      components={markdownComponents}
      disallowedElements={DISALLOWED_ELEMENTS}
      remarkPlugins={[remarkGfm]}
    >
      {children}
    </Markdown>
  </div>
);

export const AssistantProse = memo(
  AssistantProseBody,
  (previous, next) => previous.children === next.children
);
