import { spring } from "@freenary/ui/lib/springs";
import { motion } from "motion/react";
import type { ReactNode } from "react";

const FADE_DELAY = 0.1;

const STALE_OPACITY = 0.6;

export const StaleRegion = ({
  children,
  className,
  isStale,
}: {
  children: ReactNode;
  className?: string;
  isStale: boolean;
}) => (
  <motion.div
    animate={{ opacity: isStale ? STALE_OPACITY : 1 }}
    aria-busy={isStale || undefined}
    className={className}
    initial={false}
    transition={isStale ? { ...spring.fast, delay: FADE_DELAY } : spring.fast}
  >
    {children}
  </motion.div>
);
