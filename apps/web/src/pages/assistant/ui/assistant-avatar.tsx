import { BrandAvatar } from "@freenary/ui/components/brand-avatar";
import type { BrandAvatarState } from "@freenary/ui/lib/brand-avatar/states";
import { useState } from "react";

interface AssistantAvatarProps {
  state: BrandAvatarState;
  frozen?: boolean;
  label?: string;
  className?: string;
}

export const AssistantAvatar = ({
  className,
  frozen = false,
  label,
  state,
}: AssistantAvatarProps) => {
  const [pointerOver, setPointerOver] = useState(false);
  const resting = state === "idle";
  const greeting = pointerOver && !frozen && resting;

  return (
    <span
      className="inline-flex shrink-0"
      onPointerEnter={() => setPointerOver(true)}
      onPointerLeave={() => setPointerOver(false)}
    >
      <BrandAvatar
        className={className}
        frozen={frozen}
        label={label}
        state={greeting ? "happy" : state}
      />
    </span>
  );
};
