import { Button } from "@freenary/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@freenary/ui/components/card";
import { Elevated } from "@freenary/ui/lib/elevated";
import { cn } from "@freenary/ui/lib/utils";
import { RiArrowRightSLine } from "@remixicon/react";
import type { ReactElement, ReactNode } from "react";
import { useId } from "react";

import { m } from "@/paraglide/messages.js";
import { remixIcon } from "@/shared/lib/remix-icon";

interface WidgetCardProps {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headingLevel?: "h2" | "h3";
  title: string;
}

const ArrowIcon = remixIcon(RiArrowRightSLine);

export const WidgetAction = ({ children }: { children: ReactElement }) => (
  <Button asChild size="compact" trailingIcon={ArrowIcon} variant="ghost">
    {children}
  </Button>
);

export const WidgetCard = ({
  action,
  children,
  className,
  headingLevel: Heading = "h2",
  title,
}: WidgetCardProps) => {
  const headingId = useId();

  return (
    <Elevated className={cn("min-w-0 rounded-xl", className)} offset={1}>
      <section aria-labelledby={headingId} className="h-full">
        <Card className="h-full">
          <CardHeader className="min-h-9 items-center">
            <Heading className="min-w-0" id={headingId}>
              <CardTitle className="truncate">{title}</CardTitle>
            </Heading>
            {action ? (
              <CardAction className="self-center">{action}</CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">{children}</CardContent>
        </Card>
      </section>
    </Elevated>
  );
};

export const WidgetLoading = ({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) => (
  <div aria-busy="true" className="flex flex-col gap-4">
    <output className="sr-only">{label}</output>
    <div aria-hidden="true" className="flex flex-col gap-4">
      {children}
    </div>
  </div>
);

export const WidgetError = ({
  isRetrying,
  message,
  onRetry,
}: {
  isRetrying: boolean;
  message: string;
  onRetry: () => void;
}) => (
  <div className="flex flex-col items-start gap-3 py-2">
    <p className="text-muted-foreground text-sm">{message}</p>
    <Button
      loading={isRetrying}
      onClick={onRetry}
      size="compact"
      type="button"
      variant="tertiary"
    >
      {m.home_retry()}
    </Button>
  </div>
);

export const WidgetEmpty = ({ children }: { children: ReactNode }) => (
  <p className="text-muted-foreground py-2 text-sm text-pretty">{children}</p>
);

export const HeadlineAmount = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <p
    className={cn(
      "text-2xl leading-tight font-semibold tracking-tight tabular-nums",
      className
    )}
  >
    {children}
  </p>
);

export const WidgetHint = ({ children }: { children: ReactNode }) => (
  <span className="text-muted-foreground text-xs">{children}</span>
);

export type CaptionTone = "negative" | "neutral" | "positive";

const CAPTION_TONES = {
  negative: "text-destructive",
  neutral: "text-muted-foreground",
  positive: "text-success",
} satisfies Record<CaptionTone, string>;

export const WidgetCaption = ({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: CaptionTone;
}) => <p className={cn("text-sm", CAPTION_TONES[tone])}>{children}</p>;
