import { cn } from "@freenary/ui/lib/utils";
import { RiCloseLine } from "@remixicon/react";

interface FilterTokenChipProps {
  field: string;
  id?: string;
  isPending?: boolean;
  onRemove?: () => void;
  operator?: string;
  removeLabel?: string;
  value?: string;
}

const SEGMENT = "flex h-full min-w-0 items-center px-1.5";

export const FilterTokenChip = ({
  field,
  id,
  isPending = false,
  onRemove,
  operator,
  removeLabel,
  value,
}: FilterTokenChipProps) => (
  <span
    id={id}
    className={cn(
      "inline-flex h-5 max-w-full shrink-0 items-center overflow-hidden rounded text-[11px] leading-none",
      isPending && "ring-border ring-1 ring-inset"
    )}
  >
    <span className={cn(SEGMENT, "bg-active text-foreground font-medium")}>
      {field}
    </span>
    {operator && (
      <span className={cn(SEGMENT, "bg-hover text-muted-foreground")}>
        {operator}
      </span>
    )}
    {value && (
      <span className={cn(SEGMENT, "bg-hover text-foreground max-w-56")}>
        <span className="truncate">{value}</span>
      </span>
    )}
    {onRemove && (
      <button
        aria-label={removeLabel}
        className="bg-hover text-muted-foreground hover:text-foreground hover:bg-active flex h-full items-center pr-1 pl-0.5 outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)] focus-visible:ring-inset"
        onClick={onRemove}
        type="button"
      >
        <RiCloseLine aria-hidden="true" className="size-3" />
      </button>
    )}
  </span>
);
