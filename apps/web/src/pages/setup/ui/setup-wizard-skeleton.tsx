import { Skeleton } from "@freenary/ui/components/skeleton";
import { useSize } from "@freenary/ui/lib/size-context";
import { cn } from "@freenary/ui/lib/utils";

import { m } from "@/paraglide/messages.js";

const FIELD_ROWS = [0, 1, 2];

export const SetupWizardSkeleton = () => {
  const { control } = useSize();

  return (
    <div aria-busy="true">
      <output className="sr-only">{m.setup_loading()}</output>
      <div aria-hidden="true" className="flex flex-col gap-8">
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-4 w-14" />
          </div>
          <Skeleton className="h-px w-8 sm:w-12" />
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-px w-8 sm:w-12" />
          <Skeleton className="size-7 rounded-full" />
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>

        {FIELD_ROWS.map((row) => (
          <div className="flex flex-col gap-2" key={row}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className={cn(control, "w-full rounded-md")} />
          </div>
        ))}
      </div>
    </div>
  );
};
