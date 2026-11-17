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
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-56" />
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
