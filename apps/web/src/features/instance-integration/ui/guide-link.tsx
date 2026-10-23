import { RiArrowRightUpLine } from "@remixicon/react";
import type { ReactNode } from "react";

import { remixIcon } from "@/shared/lib/remix-icon";

const EXTERNAL_ICON_SIZE = 14;
const ExternalIcon = remixIcon(RiArrowRightUpLine);

interface GuideLinkProps {
  children: ReactNode;
  href: string;
}

export const GuideLink = ({ children, href }: GuideLinkProps) => (
  <a
    className="text-foreground inline-flex items-center gap-1 self-start text-sm underline underline-offset-2"
    href={href}
    rel="noopener noreferrer"
    target="_blank"
  >
    {children}
    <ExternalIcon className="shrink-0" size={EXTERNAL_ICON_SIZE} />
  </a>
);
