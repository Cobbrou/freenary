import { spring } from "@freenary/ui/lib/springs";
import { motion, useReducedMotion } from "motion/react";

import { m } from "@/paraglide/messages.js";

const FILLED = { scaleX: 1 };
const EMPTY = { scaleX: 0 };
const INSTANT = { duration: 0 };

interface WizardStepperProps {
  current: number;
  label: string;
  steps: readonly (() => string)[];
}

const spokenStep = (name: string, isDone: boolean): string =>
  isDone ? m.wizard_step_done({ step: name }) : name;

export const WizardStepper = ({
  current,
  label,
  steps,
}: WizardStepperProps) => {
  const still = useReducedMotion() ?? false;

  return (
    <div className="flex items-center gap-3">
      <ol aria-label={label} className="flex items-center gap-1">
        {steps.map((step, index) => {
          const stepName = step();
          const isReached = index <= current;

          return (
            <li
              aria-current={index === current ? "step" : undefined}
              className="bg-border relative h-1 w-6 overflow-hidden rounded-full"
              key={stepName}
            >
              <span className="sr-only">
                {spokenStep(stepName, index < current)}
              </span>
              <motion.span
                animate={isReached ? FILLED : EMPTY}
                aria-hidden="true"
                className="bg-primary absolute inset-0 rounded-full ltr:origin-left rtl:origin-right"
                initial={false}
                transition={still ? INSTANT : spring.slow}
              />
            </li>
          );
        })}
      </ol>
      <p
        aria-hidden="true"
        className="text-muted-foreground text-xs tabular-nums"
      >
        {steps[current]?.() ?? ""}
      </p>
    </div>
  );
};
