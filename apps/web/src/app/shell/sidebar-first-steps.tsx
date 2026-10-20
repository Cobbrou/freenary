import {
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@freenary/ui/components/sidebar";
import { exitFallbackMs, spring } from "@freenary/ui/lib/springs";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { m } from "@/paraglide/messages.js";

import { FIRST_STEPS } from "./first-steps";
import {
  FirstStepIconContext,
  SidebarFirstStepIcon,
} from "./sidebar-first-step-icon";
import { useFirstSteps } from "./use-first-steps";

type PanelPhase = "closing" | "hidden" | "open";

const HEADING_ID = "first-steps-heading";

const COMPLETION_HOLD_MS = 1400;

const COMPLETION_CLOSE_MS =
  COMPLETION_HOLD_MS + exitFallbackMs(spring.moderate);

const PANEL_VARIANTS = {
  exit: {
    filter: "blur(4px)",
    opacity: 0,
    transition: spring.moderate.exit,
    y: -12,
  },
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
} as const;

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    transition: spring.moderate,
    y: 0,
  },
} as const;

const PANEL_MOTION_REDUCED = {
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: spring.fast.exit },
  initial: { opacity: 0 },
  transition: spring.fast,
} as const;

const PANEL_MOTION_STAGGERED = {
  animate: "visible",
  exit: "exit",
  initial: "hidden",
  variants: PANEL_VARIANTS,
} as const;

const MotionSidebarMenuItem = motion.create(SidebarMenuItem);

const ROW_TAP = { scale: 0.96 };

const FirstStepRow = ({
  done,
  reduceMotion,
  step,
  variants,
}: {
  done: boolean;
  reduceMotion: boolean;
  step: (typeof FIRST_STEPS)[number];
  variants: typeof ITEM_VARIANTS | undefined;
}) => {
  const iconState = useMemo(
    () => ({ done, icon: step.icon }),
    [done, step.icon]
  );

  return (
    <MotionSidebarMenuItem
      transition={spring.fast}
      variants={variants}
      whileTap={reduceMotion ? undefined : ROW_TAP}
    >
      <FirstStepIconContext.Provider value={iconState}>
        <SidebarMenuButton
          className={done ? "text-sidebar-foreground/50" : undefined}
          icon={SidebarFirstStepIcon}
          render={<Link search={{ section: step.section }} to={step.to} />}
        >
          {step.label()}
          <span className="sr-only">
            {done ? m.first_steps_state_done() : m.first_steps_state_todo()}
          </span>
        </SidebarMenuButton>
      </FirstStepIconContext.Provider>
    </MotionSidebarMenuItem>
  );
};

const phaseOnceChecklistLoaded = (
  phase: PanelPhase,
  isComplete: boolean
): PanelPhase => {
  if (!isComplete) {
    return "open";
  }

  return phase === "open" ? "closing" : phase;
};

export const SidebarFirstSteps = () => {
  const state = useFirstSteps();
  const prefersReducedMotion = useReducedMotion();
  const doneCount =
    state === null
      ? 0
      : FIRST_STEPS.filter((step) => step.isDone(state)).length;

  const isComplete = state !== null && doneCount === FIRST_STEPS.length;
  const itemVariants = prefersReducedMotion ? undefined : ITEM_VARIANTS;

  const [phase, setPhase] = useState<PanelPhase>("hidden");

  if (state !== null) {
    const loadedPhase = phaseOnceChecklistLoaded(phase, isComplete);

    if (loadedPhase !== phase) {
      setPhase(loadedPhase);
    }
  }

  useEffect(() => {
    if (phase !== "closing") {
      return;
    }

    const timer = setTimeout(() => setPhase("hidden"), COMPLETION_CLOSE_MS);

    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <AnimatePresence>
      {state !== null && phase !== "hidden" && (
        <motion.div
          {...(prefersReducedMotion
            ? PANEL_MOTION_REDUCED
            : PANEL_MOTION_STAGGERED)}
          className="bg-sidebar-accent/50 ring-sidebar-border rounded-[calc(var(--radius-sm)+6px)] p-1 ring-1 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:ring-0"
        >
          <motion.div variants={itemVariants}>
            <SidebarGroupLabel className="justify-between" id={HEADING_ID}>
              <span>{m.first_steps_title()}</span>
              <span className="text-sidebar-foreground/50 tabular-nums">
                {m.first_steps_progress({
                  done: doneCount,
                  total: FIRST_STEPS.length,
                })}
              </span>
            </SidebarGroupLabel>
          </motion.div>
          <SidebarMenu aria-labelledby={HEADING_ID}>
            {FIRST_STEPS.map((step) => (
              <FirstStepRow
                done={step.isDone(state)}
                key={step.id}
                reduceMotion={prefersReducedMotion === true}
                step={step}
                variants={itemVariants}
              />
            ))}
          </SidebarMenu>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
