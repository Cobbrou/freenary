import { Button } from "@freenary/ui/components/button";
import { ScrollArea } from "@freenary/ui/components/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@freenary/ui/components/sheet";
import { Tooltip } from "@freenary/ui/components/tooltip";
import { Elevated } from "@freenary/ui/lib/elevated";
import { useSize } from "@freenary/ui/lib/size-context";
import { cn } from "@freenary/ui/lib/utils";
import { Renderer } from "@openuidev/react-lang";
import type { ParseResult } from "@openuidev/react-lang";
import { RiBarChartBoxLine, RiFullscreenLine } from "@remixicon/react";
import { useState } from "react";

import { m } from "@/paraglide/messages.js";

import { assistantUiLibrary } from "./assistant-ui-library";

interface AssistantChartProps {
  program: string;
  streaming: boolean;
}

interface ProgramParse {
  program: string;
  result: ParseResult | null;
}

const HEADER_PAD = { compact: "px-2.5 py-1", default: "px-3 py-1.5" } as const;

const isBroken = (parse: ParseResult | null): boolean => {
  if (parse === null || parse.root === null) {
    return true;
  }

  const { children } = parse.root.props;
  const everyChildDropped = Array.isArray(children) && children.length === 0;

  return parse.meta.errors.length > 0 || everyChildDropped;
};

export const AssistantChart = ({ program, streaming }: AssistantChartProps) => {
  const size = useSize();
  const [parsed, setParsed] = useState<ProgramParse>();
  const [large, setLarge] = useState(false);
  const failed =
    !streaming &&
    parsed !== undefined &&
    parsed.program === program &&
    isBroken(parsed.result);

  if (failed) {
    return (
      <p className="text-muted-foreground my-2 text-xs">
        {m.assistant_chart_failed()}
      </p>
    );
  }

  return (
    <Elevated
      className="my-2 flex w-full shrink-0 flex-col overflow-hidden rounded-xl"
      offset={1}
    >
      <div
        className={cn(
          "bg-muted/40 flex items-center justify-between border-b",
          size.gap,
          HEADER_PAD[size.variant]
        )}
      >
        <p className="text-muted-foreground flex items-center gap-1.5 truncate text-xs font-medium">
          <RiBarChartBoxLine className="size-3.5" />
          {m.assistant_chart_label()}
          {streaming && (
            <span className="shimmer-text">{m.assistant_chart_drawing()}</span>
          )}
        </p>
        <Tooltip content={m.assistant_chart_expand()}>
          <Button
            aria-label={m.assistant_chart_expand()}
            disabled={streaming}
            onClick={() => setLarge(true)}
            size="icon-compact"
            type="button"
            variant="ghost"
          >
            <RiFullscreenLine />
          </Button>
        </Tooltip>
      </div>
      <Renderer
        isStreaming={streaming}
        library={assistantUiLibrary}
        onParseResult={(parse) => setParsed({ program, result: parse })}
        response={program}
      />
      <Sheet onOpenChange={setLarge} open={large}>
        <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>{m.assistant_chart_label()}</SheetTitle>
            <SheetDescription className="sr-only">
              {m.assistant_chart_expand()}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea
            className="min-h-0 flex-1"
            viewportClassName="p-4 text-sm [&_[data-slot=chart].w-full]:h-80"
          >
            <Renderer library={assistantUiLibrary} response={program} />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </Elevated>
  );
};
