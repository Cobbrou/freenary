import { Skeleton } from "@freenary/ui/components/skeleton";

export const TransactionRowsSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="flex flex-col gap-1 py-2">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex items-center gap-3 px-1 py-2">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex flex-1 flex-col gap-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
    ))}
  </div>
);
