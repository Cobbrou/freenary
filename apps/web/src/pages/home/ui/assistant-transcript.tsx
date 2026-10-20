"use client";

import { Button } from "@freenary/ui/components/button";
import { useSize } from "@freenary/ui/lib/size-context";
import { cn } from "@freenary/ui/lib/utils";
import { RiArrowDownLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

interface AssistantTranscriptProps {
  children: ReactNode;
  scrollLabel: string;
}

const contentSpacing = {
  compact: "gap-6 p-3",
  default: "gap-8 p-4",
} as const;

const BOTTOM_SLACK_PX = 32;

export const AssistantTranscript = ({
  children,
  scrollLabel,
}: AssistantTranscriptProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isFollowingNewestRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const size = useSize();

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;

    if (!(viewport && content)) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (isFollowingNewestRef.current) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });

    observer.observe(content);

    return () => observer.disconnect();
  }, []);

  const onScroll = () => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const distance =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    const bottom = distance <= BOTTOM_SLACK_PX;
    isFollowingNewestRef.current = bottom;
    setAtBottom(bottom);
  };

  const catchUp = () => {
    viewportRef.current?.scrollTo({
      behavior: "smooth",
      top: viewportRef.current.scrollHeight,
    });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={onScroll}
        ref={viewportRef}
        role="log"
      >
        <div
          className={cn("flex flex-col", contentSpacing[size.variant])}
          ref={contentRef}
        >
          {children}
        </div>
      </div>
      {!atBottom && (
        <Button
          aria-label={scrollLabel}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full"
          onClick={catchUp}
          size="icon"
          type="button"
          variant="tertiary"
        >
          <RiArrowDownLine />
        </Button>
      )}
    </div>
  );
};
