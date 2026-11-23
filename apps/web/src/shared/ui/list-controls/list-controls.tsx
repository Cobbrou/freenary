import { Badge } from "@freenary/ui/components/badge";
import { Button } from "@freenary/ui/components/button";
import { FluidHoverHighlight } from "@freenary/ui/components/fluid-hover-highlight";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@freenary/ui/components/input-addons";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@freenary/ui/components/toggle-group";
import {
  useFluidHover,
  useRegisterFluidHoverItem,
} from "@freenary/ui/hooks/use-fluid-hover";
import { spring } from "@freenary/ui/lib/springs";
import { cn } from "@freenary/ui/lib/utils";
import { RiCloseLine, RiSearchLine } from "@remixicon/react";
import { motion } from "motion/react";
import { useRef } from "react";
import type { ReactNode } from "react";

import { m } from "@/paraglide/messages.js";

import { useHoverIntent } from "./use-hover-intent";
import { useSettledText } from "./use-settled-text";

interface ChipPosition {
  index: number;
  registerItem: (index: number, element: HTMLElement | null) => void;
}

export const PRESS_MOTION = {
  transition: spring.fast,
  whileTap: { scale: 0.96 },
} as const;

export const ListFilterBar = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-2">{children}</div>
);

export const ListSearchInput = ({
  onChange,
  placeholder,
  value,
}: {
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) => {
  const { draft, setDraft } = useSettledText(value, onChange);

  return (
    <InputGroup className="min-w-40 flex-1">
      <InputGroupAddon>
        <RiSearchLine />
      </InputGroupAddon>
      <InputGroupInput
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={draft}
      />
    </InputGroup>
  );
};

export const ListSortToggle = <T extends string>({
  label,
  onChange,
  onIntent,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  onIntent?: (value: T) => void;
  options: readonly { label: string; value: T }[];
  value: T;
}) => {
  const intent = useHoverIntent(onIntent);

  return (
    <ToggleGroup
      aria-label={label}
      onValueChange={([next]) => {
        const chosen = options.find((option) => option.value === next);

        if (chosen) {
          onChange(chosen.value);
        }
      }}
      spacing={0}
      value={[value]}
      variant="outline"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          render={<motion.button {...PRESS_MOTION} />}
          value={option.value}
          {...(option.value === value ? undefined : intent(option.value))}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
};

export const ListFilterChips = ({
  children,
}: {
  children: (position: (index: number) => ChipPosition) => ReactNode;
}) => {
  const stripRef = useRef<HTMLDivElement>(null);
  const hover = useFluidHover(stripRef, { axis: "x", nearest: true });

  return (
    <div
      className="relative flex flex-wrap items-center gap-1.5"
      ref={stripRef}
      {...hover.handlers}
    >
      <FluidHoverHighlight className="rounded-lg" hover={hover} />
      {children((index) => ({ index, registerItem: hover.registerItem }))}
    </div>
  );
};

export const ListFilterChip = ({
  icon,
  label,
  onRemove,
  position,
  truncate = false,
}: {
  icon?: ReactNode;
  label: string;
  onRemove: () => void;
  position: ChipPosition;
  truncate?: boolean;
}) => {
  const badgeRef = useRef<HTMLSpanElement>(null);

  useRegisterFluidHoverItem(position.registerItem, position.index, badgeRef);

  return (
    <button
      aria-label={m.budget_filter_remove({ label })}
      className="group contents"
      onClick={onRemove}
      type="button"
    >
      <Badge
        className={cn(
          "group-focus-visible:ring-1 group-focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
          truncate && "max-w-48"
        )}
        ref={badgeRef}
        variant="dot"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {icon && <span className="flex shrink-0 items-center">{icon}</span>}
          {truncate ? <span className="min-w-0 truncate">{label}</span> : label}
          <RiCloseLine className="size-3.5 shrink-0" />
        </span>
      </Badge>
    </button>
  );
};

export const ClearFiltersButton = ({ onClear }: { onClear: () => void }) => (
  <Button onClick={onClear} variant="ghost">
    {m.budget_filter_clear_all()}
  </Button>
);
