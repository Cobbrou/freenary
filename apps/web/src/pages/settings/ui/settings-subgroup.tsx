import type * as React from "react";
import { useId } from "react";

interface SettingsSubgroupProps {
  action?: React.ReactNode;
  children: React.ReactNode;
  description: string;
  title: string;
}

export const SettingsSubgroup = ({
  action,
  children,
  description,
  title,
}: SettingsSubgroupProps) => {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-sm font-semibold" id={headingId}>
            {title}
          </h3>
          <p className="text-muted-foreground text-[13px] leading-normal">
            {description}
          </p>
        </div>
        {action}
      </div>

      {children}
    </section>
  );
};
