import { FluidHoverHighlight } from "@freenary/ui/components/fluid-hover-highlight";
import type { UseFluidHoverReturn } from "@freenary/ui/hooks/use-fluid-hover";
import { useShape } from "@freenary/ui/lib/shape-context";
import { cn } from "@freenary/ui/lib/utils";
import type { ReactNode, Ref } from "react";

import { SETTINGS_BLEED } from "./settings-section";

interface SettingsRowListProps {
  children: ReactNode;
  className?: string;
  hover: UseFluidHoverReturn;
  ref: Ref<HTMLUListElement>;
}

const ITEM_SIDE_BORDER_CANCEL = "[&>li]:border-x-0";

export const SettingsRowList = ({
  children,
  className,
  hover,
  ref,
}: SettingsRowListProps) => {
  const shape = useShape();

  return (
    <ul
      className={cn(
        "relative flex flex-col gap-1.5",
        ITEM_SIDE_BORDER_CANCEL,
        SETTINGS_BLEED,
        className
      )}
      ref={ref}
      {...hover.handlers}
    >
      <FluidHoverHighlight className={shape.bg} hover={hover} />
      {children}
    </ul>
  );
};
