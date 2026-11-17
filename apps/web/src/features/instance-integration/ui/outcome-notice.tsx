import { spring } from "@freenary/ui/lib/springs";
import { cn } from "@freenary/ui/lib/utils";
import { RiCheckLine, RiErrorWarningLine } from "@remixicon/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { m } from "@/paraglide/messages.js";
import { remixIcon } from "@/shared/lib/remix-icon";

import type { SaveOutcome } from "../model/outcome";
import {
  isFailedOutcome,
  outcomeDetail,
  outcomeMessage,
} from "../model/outcome";

const NOTICE_ICON_SIZE = 16;
const ICON_SWAP = { bounce: 0, duration: 0.3, type: "spring" } as const;
const ICON_HIDDEN = { filter: "blur(4px)", opacity: 0, scale: 0.25 };
const ICON_SHOWN = { filter: "blur(0px)", opacity: 1, scale: 1 };

const REDUCED_REVEAL = {
  height: { duration: 0 },
  opacity: { duration: 0.15 },
} as const;

const INSTANT = { duration: 0 } as const;
const AlertIcon = remixIcon(RiErrorWarningLine);
const CheckIcon = remixIcon(RiCheckLine);

interface OutcomeNoticeProps {
  outcome: SaveOutcome | undefined;
  provider: string;
}

const OutcomeNoticeBody = ({
  outcome,
  provider,
}: {
  outcome: SaveOutcome;
  provider: string;
}) => {
  const isFailure = isFailedOutcome(outcome);
  const detail = isFailure ? outcomeDetail(outcome) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <p
        className={cn(
          "flex items-start gap-2 text-sm",
          isFailure ? "text-destructive" : "text-muted-foreground"
        )}
        role={isFailure ? "alert" : "status"}
      >
        <span className="relative mt-0.5 flex size-4 shrink-0">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={ICON_SHOWN}
              aria-hidden="true"
              className="absolute inset-0 flex"
              exit={ICON_HIDDEN}
              initial={ICON_HIDDEN}
              key={isFailure ? "failure" : "success"}
              transition={ICON_SWAP}
            >
              {isFailure ? (
                <AlertIcon size={NOTICE_ICON_SIZE} />
              ) : (
                <CheckIcon size={NOTICE_ICON_SIZE} />
              )}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="min-w-0">{outcomeMessage(outcome, provider)}</span>
      </p>
      {detail === null ? null : (
        <details className="text-muted-foreground ps-6 text-xs">
          <summary className="cursor-pointer select-none">
            {m.setup_show_details()}
          </summary>
          <p className="mt-1 font-mono break-words">{detail}</p>
        </details>
      )}
    </div>
  );
};

export const OutcomeNotice = ({ outcome, provider }: OutcomeNoticeProps) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {outcome === undefined ? null : (
        <motion.div
          key="outcome"
          animate={{
            height: "auto",
            opacity: 1,
            transitionEnd: { overflow: "visible" },
          }}
          className="-mt-6"
          exit={{
            height: 0,
            opacity: 0,
            overflow: "hidden",
            transition: prefersReducedMotion ? INSTANT : spring.moderate.exit,
          }}
          initial={{ height: 0, opacity: 0, overflow: "hidden" }}
          transition={prefersReducedMotion ? REDUCED_REVEAL : spring.moderate}
        >
          <div className="pt-6">
            <OutcomeNoticeBody outcome={outcome} provider={provider} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
