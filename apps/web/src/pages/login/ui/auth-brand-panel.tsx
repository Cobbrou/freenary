import { motion, useReducedMotion } from "motion/react";

import { m } from "@/paraglide/messages.js";
import { PinkBackdrop } from "@/shared/ui/pink-backdrop";

const PITCH_LINES = [
  { id: "connect", text: m.auth_pitch_connect },
  { id: "see", text: m.auth_pitch_see },
  { id: "know", text: m.auth_pitch_know },
] as const;

const STRONG_EASE_OUT = [0.23, 1, 0.32, 1] as const;
const LINE_SECONDS = 0.6;
const LINE_STAGGER_SECONDS = 0.12;
const FIRST_LINE_DELAY_SECONDS = 0.15;
const RISE_PX = 12;

const lineMotion = (order: number, reduceMotion: boolean) => ({
  animate: { filter: "blur(0px)", opacity: 1, y: 0 },
  initial: reduceMotion
    ? { opacity: 0 }
    : { filter: "blur(4px)", opacity: 0, y: RISE_PX },
  transition: {
    delay: FIRST_LINE_DELAY_SECONDS + order * LINE_STAGGER_SECONDS,
    duration: LINE_SECONDS,
    ease: STRONG_EASE_OUT,
  },
});

export const AuthBrandPanel = () => {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <div className="relative hidden overflow-hidden lg:flex lg:flex-col">
      <PinkBackdrop />
      <div className="relative flex flex-1 items-center p-12 xl:p-16">
        <h2 className="font-heading text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
          {PITCH_LINES.map((line, order) => (
            <motion.span
              className="block"
              key={line.id}
              {...lineMotion(order, reduceMotion)}
            >
              {line.text()}
            </motion.span>
          ))}
        </h2>
      </div>
      <div className="relative p-12 pt-0 xl:p-16 xl:pt-0">
        <p className="text-lg font-bold tracking-tight">freenary</p>
        <p className="text-foreground/70 text-sm italic">{m.auth_tagline()}</p>
      </div>
    </div>
  );
};
