import { Skeleton } from "@freenary/ui/components/skeleton";
import { useSize } from "@freenary/ui/lib/size-context";
import { cn } from "@freenary/ui/lib/utils";

import { BankListSkeleton } from "@/features/bank-connection";
import { m } from "@/paraglide/messages.js";

export const OnboardingWizardSkeleton = () => {
  const { control } = useSize();

  return (
    <div aria-busy="true">
      <output className="sr-only">{m.onboarding_loading()}</output>
      <div aria-hidden="true" className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-56" />
        </div>

        <Skeleton className={cn(control, "w-full rounded-md")} />

        <BankListSkeleton rows={4} />
      </div>
    </div>
  );
};
