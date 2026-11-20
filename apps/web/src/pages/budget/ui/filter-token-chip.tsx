import { cn } from "@freenary/ui/lib/utils";
import { RiCloseLine } from "@remixicon/react";

interface FilterTokenChipProps {
  field: string;
  id?: string;
  isPending?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
  value?: string;
}

export const FilterTokenChip = ({
  field,
  id,
  isPending = false,
  onRemove,
  removeLabel,
  value,
}: FilterTokenChipProps) => (
  <span
    className={cn(
      "inline-flex h-6 max-w-full shrink-0 items-center overflow-hidden rounded-md text-xs",
      isPending
        ? "border-border border border-dashed"
        : "ring-border ring-1 ring-inset"
    )}
    id={id}
  >
    <span className="bg-muted text-muted-foreground flex h-full items-center px-1.5 lowercase">
      {field}
    </span>
    {value && (
      <span className="text-foreground flex h-full max-w-56 min-w-0 items-center ps-1.5 pe-1">
        <span className="truncate" title={value}>
          {value}
        </span>
      </span>
    )}
    {onRemove && (
      <button
        aria-label={removeLabel}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex h-full items-center px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset"
        onClick={onRemove}
        type="button"
      >
        <RiCloseLine aria-hidden="true" className="size-3.5" />
      </button>
    )}
  </span>
);
