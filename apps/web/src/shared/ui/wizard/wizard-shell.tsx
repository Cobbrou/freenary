import { BrandAvatar } from "@freenary/ui/components/brand-avatar";
import type { BrandAvatarState } from "@freenary/ui/lib/brand-avatar/states";
import { spring } from "@freenary/ui/lib/springs";
import { SURFACE_BG } from "@freenary/ui/lib/surface-classes";
import { SurfaceProvider } from "@freenary/ui/lib/surface-context";
import { cn } from "@freenary/ui/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { LocaleSwitcher } from "../locale-switcher";
import { PinkBackdrop } from "../pink-backdrop";
import { ThemeSwitcher } from "../theme-switcher";

const STEP_SHIFT_PX = 16;
const NO_STEP_SHIFT_PX = 0;
const STEP_CROSSFADE_MASK_BLUR = "blur(4px)";
const NO_BLUR = "blur(0px)";
const AGENT_PX = 40;

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
  avatarState?: BrandAvatarState;
  children: ReactNode;
  direction: 1 | -1;
  isPending: boolean;
  skeleton: ReactNode;
  stepKey: string;
  stepper: ReactNode;
  toolbar: ReactNode;
}

export const WizardShell = ({
  avatarState = "idle",
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

  const column = (
    <div className="flex min-h-svh min-w-0 flex-col px-5 sm:min-h-0 sm:px-8">
      <header className="mx-auto flex min-h-16 w-full max-w-md flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-6">
        <BrandAvatar
          size={AGENT_PX}
          state={isPending ? "loading" : avatarState}
        />
        {isPending ? null : stepper}
      </header>

      <div className="flex flex-1 items-center">
        <div className="relative mx-auto flex w-full max-w-md flex-col py-12">
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
                exit={{ opacity: 0, transition: spring.moderate.exit }}
                initial={{ opacity: 0 }}
                transition={spring.moderate}
              >
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

      <footer className="mx-auto flex w-full max-w-md flex-wrap items-center gap-1 pb-5">
        <ThemeSwitcher />
        <LocaleSwitcher />
        <span className="ms-auto">{toolbar}</span>
      </footer>
    </div>
  );

  return (
    <SurfaceProvider value={1}>
      <main
        className="relative grid min-h-svh place-items-center sm:p-6"
        data-wizard-headline
      >
        <PinkBackdrop />
        <div
          className={cn(
            SURFACE_BG[1],
            "relative w-full sm:max-w-xl sm:rounded-2xl sm:shadow-2xl"
          )}
        >
          {column}
        </div>
      </main>
    </SurfaceProvider>
  );
};
