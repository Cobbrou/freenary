import { useIcon } from "@freenary/ui/lib/icon-context";
import { useSize } from "@freenary/ui/lib/size-context";
import { spring } from "@freenary/ui/lib/springs";
import { SURFACE_BG } from "@freenary/ui/lib/surface-classes";
import { useSurface } from "@freenary/ui/lib/surface-context";
import { cn } from "@freenary/ui/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { Fragment } from "react";

const LABELS_FIT_UP_TO = 3;
const ICON_SWAP = { bounce: 0, duration: 0.3, type: "spring" } as const;
const ICON_HIDDEN = { filter: "blur(4px)", opacity: 0, scale: 0.25 };
const ICON_SHOWN = { filter: "blur(0px)", opacity: 1, scale: 1 };

interface WizardStepperProps {
  current: number;
  label: string;
  steps: readonly (() => string)[];
}

export const WizardStepper = ({
  current,
  label,
  steps,
}: WizardStepperProps) => {
  const CheckIcon = useIcon("check");
  const size = useSize();
  const substrate = useSurface();
  const showsEveryLabel = steps.length <= LABELS_FIT_UP_TO;

  return (
    <ol aria-label={label} className="flex items-center justify-center">
      {steps.map((step, index) => {
        const stepName = step();
        const isComplete = index < current;
        const isCurrent = index === current;

        return (
          <Fragment key={stepName}>
            <li className="flex items-center gap-2.5">
              <motion.span
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex aspect-square shrink-0 items-center justify-center rounded-full ring-1",
                  size.control,
                  size.text,
                  isComplete &&
                    "bg-primary text-primary-foreground ring-primary",
                  isCurrent && "bg-secondary text-foreground ring-primary",
                  !(isComplete || isCurrent) &&
                    cn(
                      SURFACE_BG[substrate],
                      "text-muted-foreground ring-border"
                    )
                )}
                transition={spring.fast}
              >
                <AnimatePresence initial={false} mode="wait">
                  {isComplete ? (
                    <motion.span
                      animate={ICON_SHOWN}
                      exit={ICON_HIDDEN}
                      initial={ICON_HIDDEN}
                      key="check"
                      transition={ICON_SWAP}
                    >
                      <CheckIcon size={size.icon} />
                    </motion.span>
                  ) : (
                    <motion.span
                      animate={ICON_SHOWN}
                      exit={ICON_HIDDEN}
                      initial={ICON_HIDDEN}
                      key="index"
                      transition={ICON_SWAP}
                    >
                      {index + 1}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.span>
              {showsEveryLabel || isCurrent ? (
                <span
                  className={cn(
                    size.text,
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {stepName}
                </span>
              ) : null}
            </li>
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="bg-border mx-3 h-px w-8 overflow-hidden sm:w-12"
              >
                <motion.span
                  animate={{ scaleX: isComplete ? 1 : 0 }}
                  className="bg-primary block h-px w-full origin-left"
                  initial={false}
                  transition={spring.slow}
                />
              </span>
            )}
          </Fragment>
        );
      })}
    </ol>
  );
};
