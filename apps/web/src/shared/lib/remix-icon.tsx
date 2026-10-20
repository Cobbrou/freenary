import type {
  IconComponent,
  IconComponentProps,
} from "@freenary/ui/lib/icon-context";
import type { RemixiconComponentType } from "@remixicon/react";

const cache = new Map<RemixiconComponentType, IconComponent>();

export const remixIcon = (Icon: RemixiconComponentType): IconComponent => {
  let adapted = cache.get(Icon);

  if (!adapted) {
    adapted = ({ className, size, strokeWidth }: IconComponentProps) => (
      <Icon className={className} size={size} strokeWidth={strokeWidth} />
    );

    cache.set(Icon, adapted);
  }

  return adapted;
};
