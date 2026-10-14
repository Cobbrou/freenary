import { spring } from "@freenary/ui/lib/springs";
import { SURFACE_BG } from "@freenary/ui/lib/surface-classes";
import { SurfaceProvider } from "@freenary/ui/lib/surface-context";
import { cn } from "@freenary/ui/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { LocaleSwitcher } from "@/shared/ui/locale-switcher";
import { ThemeSwitcher } from "@/shared/ui/theme-switcher";

const STEP_SHIFT_PX = 16;
const NO_STEP_SHIFT_PX = 0;
const STEP_CROSSFADE_MASK_BLUR = "blur(4px)";
const NO_BLUR = "blur(0px)";

interface StepMotion {
  direction: 1 | -1;
  shift: number;
}

const stepVariants = {
  center: { filter: NO_BLUR, opacity: 1, transition: spring.slow, x: 0 },
  enter: ({ direction, shift }: StepMotion) => ({
    filter: shift ? STEP_CROSSFADE_MASK_BLUR : NO_BLUR,
    opacity: 0,
    x: direction * shift,
  }),
  exit: ({ direction, shift }: StepMotion) => ({
    filter: shift ? STEP_CROSSFADE_MASK_BLUR : NO_BLUR,
    opacity: 0,
    transition: spring.slow.exit,
    x: -direction * shift,
  }),
};

interface WizardShellProps {
  children: ReactNode;
  direction: 1 | -1;
  isPending: boolean;
  skeleton: ReactNode;
  stepKey: string;
  stepper: ReactNode;
  toolbar: ReactNode;
}

export const WizardShell = ({
  children,
  direction,
  isPending,
  skeleton,
  stepKey,
  stepper,
  toolbar,
}: WizardShellProps) => {
  const prefersReducedMotion = useReducedMotion();
  const stepMotion: StepMotion = {
    direction,
    shift: prefersReducedMotion ? NO_STEP_SHIFT_PX : STEP_SHIFT_PX,
  };

  return (
    <SurfaceProvider value={1}>
      <main className={cn(SURFACE_BG[1], "flex min-h-svh flex-col")}>
        <div className="flex items-center justify-end gap-1 px-4 py-3">
          <ThemeSwitcher />
          <LocaleSwitcher />
          {toolbar}
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="relative flex w-full max-w-md flex-col gap-8">
            <AnimatePresence initial={false} mode="popLayout">
              {isPending ? (
                <motion.div
                  key="skeleton"
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: spring.moderate.exit }}
                  initial={{ opacity: 0 }}
                  transition={spring.moderate}
                >
                  {skeleton}
                </motion.div>
              ) : (
                <motion.div
                  key="wizard"
                  animate={{ opacity: 1 }}
                  className="flex flex-col gap-8"
                  exit={{ opacity: 0, transition: spring.moderate.exit }}
                  initial={{ opacity: 0 }}
                  transition={spring.moderate}
                >
                  {stepper}
                  <AnimatePresence
                    custom={stepMotion}
                    initial={false}
                    mode="popLayout"
                  >
                    <motion.div
                      key={stepKey}
                      animate="center"
                      custom={stepMotion}
                      exit="exit"
                      initial="enter"
                      variants={stepVariants}
                    >
                      {children}
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </SurfaceProvider>
  );
};
