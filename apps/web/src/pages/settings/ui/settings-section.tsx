import { cn } from "@freenary/ui/lib/utils";
import type * as React from "react";
import { useId } from "react";

interface SettingsHeadingProps {
  action?: React.ReactNode;
  children?: React.ReactNode;
  description: string;
  title: string;
}

export const SETTINGS_BLEED = "-mx-3";

const SETTINGS_PROSE = "text-[13px] leading-normal";

const HEADER_ROW = "flex flex-wrap items-start justify-between gap-x-6 gap-y-3";

const HEADER_TEXT = "flex max-w-prose min-w-0 flex-1 basis-64 flex-col";

const ROWS_ON_THE_HEADING_EDGE =
  "[&_[data-slot=item]]:px-0 [&>div]:px-0 [&>p]:px-0";

const TOUCH_TARGETS =
  "pointer-coarse:[&_button]:min-h-11 pointer-coarse:[&_button]:min-w-11";

export const SettingsPane = ({
  action,
  children,
  description,
  title,
}: SettingsHeadingProps) => {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-6"
    >
      <div className={HEADER_ROW}>
        <div className={cn(HEADER_TEXT, "gap-1")}>
          <h2
            className="font-heading text-lg font-semibold tracking-tight text-balance"
            id={headingId}
          >
            {title}
          </h2>
          <p
            className={cn("text-muted-foreground text-pretty", SETTINGS_PROSE)}
          >
            {description}
          </p>
        </div>
        {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
      </div>

      {children ? (
        <div className={cn("flex flex-col gap-10", SETTINGS_PROSE)}>
          {children}
        </div>
      ) : null}
    </section>
  );
};

export const SettingsSection = ({
  action,
  children,
  description,
  title,
}: SettingsHeadingProps) => {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className={HEADER_ROW}>
        <div className={cn(HEADER_TEXT, "gap-0.5")}>
          <h3 className="text-sm font-semibold" id={headingId}>
            {title}
          </h3>
          <p
            className={cn("text-muted-foreground text-pretty", SETTINGS_PROSE)}
          >
            {description}
          </p>
        </div>
        {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
      </div>

      {children ? (
        <div className={cn("flex flex-col gap-3", SETTINGS_PROSE)}>
          {children}
        </div>
      ) : null}
    </section>
  );
};

export const SettingsList = ({ children }: { children: React.ReactNode }) => (
  <div className={cn(ROWS_ON_THE_HEADING_EDGE, TOUCH_TARGETS)}>{children}</div>
);
