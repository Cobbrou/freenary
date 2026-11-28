import { Button } from "@freenary/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@freenary/ui/components/dialog";
import { cn } from "@freenary/ui/lib/utils";
import { RiPauseFill, RiPlayFill } from "@remixicon/react";
import { Match } from "effect";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useReducer, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { categoryLabel } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { formatCurrency } from "@/shared/lib/format-currency";
import { readableName } from "@/shared/lib/text";

import {
  merchantKeyName,
  STORY_SLIDE_MS,
  STORY_START,
  STORY_TICK_MS,
  storyReducer,
  storySlides,
} from "../model/year-review";
import type { StorySlide, YearReview } from "../model/year-review";
import { dayLabel, formatShare, monthLabel } from "./year-review-format";

interface YearReviewStoryProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  review: YearReview;
}

const GRADIENTS = [
  "from-fuchsia-700 to-orange-500",
  "from-indigo-700 to-cyan-600",
  "from-emerald-700 to-teal-500",
  "from-rose-700 to-amber-600",
  "from-violet-800 to-pink-600",
  "from-sky-700 to-emerald-600",
] as const;

const SlideText = ({
  body,
  headline,
  title,
}: {
  body?: string;
  headline?: string;
  title: string;
}) => (
  <>
    <p className="text-lg font-medium text-white/85">{title}</p>
    {headline !== undefined && (
      <p className="font-heading text-5xl leading-none font-semibold tracking-tight break-words tabular-nums">
        {headline}
      </p>
    )}
    {body !== undefined && (
      <p className="text-lg text-pretty text-white/85">{body}</p>
    )}
  </>
);

const slideContent = (slide: StorySlide, review: YearReview): ReactNode => {
  const money = (amountMinor: number) =>
    formatCurrency(amountMinor, review.currency);

  return Match.value(slide).pipe(
    Match.discriminatorsExhaustive("kind")({
      category: ({ amountMinor, category, share }) => (
        <SlideText
          body={`${m.year_review_story_category_body({ share: formatShare(share) })} · ${money(amountMinor)}`}
          headline={categoryLabel(category)}
          title={m.year_review_story_category_title()}
        />
      ),
      intro: ({ year }) => (
        <SlideText
          body={m.year_review_story_intro_body()}
          headline={m.year_review_story_intro_title({ year: String(year) })}
          title={m.nav_year_review()}
        />
      ),
      largest: ({ expense }) => (
        <SlideText
          body={m.year_review_story_largest_body({
            date: dayLabel(expense.date),
            merchant: readableName(
              merchantKeyName(expense) || categoryLabel(expense.category)
            ),
          })}
          headline={money(expense.amountMinor)}
          title={m.year_review_story_largest_title()}
        />
      ),
      merchant: ({ merchant }) => (
        <SlideText
          body={`${money(merchant.totalMinor)} · ${m.year_review_payments({ count: merchant.count })}`}
          headline={readableName(merchantKeyName(merchant))}
          title={m.year_review_story_merchant_title()}
        />
      ),
      month: ({ month, outgoingMinor }) => (
        <SlideText
          body={m.year_review_story_month_body({
            amount: money(outgoingMinor),
          })}
          headline={monthLabel(month, "long")}
          title={m.year_review_story_month_title()}
        />
      ),
      "net-worth": ({ changeMinor, endMinor }) => {
        const amount = money(Math.abs(changeMinor));

        return (
          <SlideText
            body={
              changeMinor >= 0
                ? m.year_review_net_worth_up({ amount })
                : m.year_review_net_worth_down({ amount })
            }
            headline={money(endMinor)}
            title={m.year_review_story_net_worth_title()}
          />
        );
      },
      outro: ({ year }) => (
        <SlideText
          body={m.year_review_story_outro_body()}
          headline={m.year_review_story_outro_title({ year: String(year) })}
          title={m.nav_year_review()}
        />
      ),
      recurring: ({ merchantCount, totalMinor }) => (
        <SlideText
          body={m.year_review_recurring_total({ count: merchantCount })}
          headline={money(totalMinor)}
          title={m.year_review_story_recurring_title()}
        />
      ),
      regular: ({ merchant }) => (
        <SlideText
          body={m.year_review_story_regular_body({
            amount: money(merchant.totalMinor),
            count: merchant.count,
          })}
          headline={readableName(merchantKeyName(merchant))}
          title={m.year_review_story_regular_title()}
        />
      ),
      saved: ({ savedMinor, savingsRate }) =>
        savingsRate >= 0 ? (
          <SlideText
            body={m.year_review_story_saved_body({ amount: money(savedMinor) })}
            headline={formatShare(savingsRate)}
            title={m.year_review_story_saved_title()}
          />
        ) : (
          <SlideText
            body={m.year_review_story_overspent_body({
              amount: money(-savedMinor),
            })}
            headline={money(-savedMinor)}
            title={m.year_review_story_overspent_title()}
          />
        ),
      spent: ({ change, expensesMinor }) => {
        let body = m.year_review_payments({
          count: review.current.paymentCount,
        });

        if (change !== null) {
          body =
            change >= 0
              ? m.year_review_story_spent_up({ change: formatShare(change) })
              : m.year_review_story_spent_down({
                  change: formatShare(Math.abs(change)),
                });
        }

        return (
          <SlideText
            body={body}
            headline={money(expensesMinor)}
            title={m.year_review_story_spent_title()}
          />
        );
      },
    })
  );
};

export const YearReviewStory = ({
  onOpenChange,
  open,
  review,
}: YearReviewStoryProps) => {
  const slides = useMemo(() => storySlides(review), [review]);
  const [{ elapsedMs, index }, dispatch] = useReducer(
    storyReducer,
    STORY_START
  );

  const [isPaused, setIsPaused] = useState(false);
  const isReducedMotion = useReducedMotion() ?? false;
  const last = slides.length - 1;
  const isLast = index === last;
  const slide = slides[index];

  useEffect(() => {
    if (!open || isPaused || isLast) {
      return;
    }

    const timer = setInterval(() => {
      dispatch({ kind: "tick", last });
    }, STORY_TICK_MS);

    return () => {
      clearInterval(timer);
    };
  }, [isLast, isPaused, last, open]);

  const go = (step: -1 | 1) => dispatch({ kind: "go", last, step });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      go(1);
    } else if (event.key === "ArrowLeft") {
      go(-1);
    }
  };

  const shift = isReducedMotion ? 0 : 16;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex h-[min(calc(100dvh-2rem),44rem)] max-w-[420px] flex-col overflow-hidden p-0 text-white [&>button:last-child]:text-white"
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">
          {m.year_review_title({ year: String(review.year) })}
        </DialogTitle>
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 bg-linear-to-br transition-colors duration-700",
            GRADIENTS[index % GRADIENTS.length]
          )}
        />
        <div aria-hidden="true" className="relative flex gap-1 px-4 pe-14 pt-4">
          {slides.map((entry, position) => {
            let progress = 0;

            if (position < index) {
              progress = 1;
            } else if (position === index) {
              progress = isLast ? 1 : elapsedMs / STORY_SLIDE_MS;
            }

            return (
              <span
                className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
                key={entry.kind}
              >
                <span
                  className="block h-full origin-left rounded-full bg-white"
                  style={{ transform: `scaleX(${progress})` }}
                />
              </span>
            );
          })}
        </div>
        <p className="sr-only">
          {m.year_review_story_progress({
            current: String(index + 1),
            total: String(slides.length),
          })}
        </p>
        <button
          aria-label={m.year_review_story_previous()}
          className="absolute inset-y-0 start-0 w-1/3 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none focus-visible:ring-inset"
          onClick={() => go(-1)}
          type="button"
        />
        <button
          aria-label={m.year_review_story_next()}
          className="absolute inset-y-0 end-0 w-2/3 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none focus-visible:ring-inset"
          onClick={() => go(1)}
          type="button"
        />
        <div
          aria-live="polite"
          className="pointer-events-none relative flex flex-1 flex-col"
        >
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-1 flex-col justify-center gap-4 px-8"
              exit={{ opacity: 0, y: -shift }}
              initial={{ opacity: 0, y: shift }}
              key={index}
            >
              {slide && slideContent(slide, review)}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="relative flex items-center justify-between gap-2 px-4 pb-4">
          {isLast ? (
            <>
              <Button
                className="bg-white/15 text-white hover:bg-white/25"
                onClick={() => dispatch({ kind: "restart" })}
                variant="ghost"
              >
                {m.year_review_story_replay()}
              </Button>
              <Button
                className="bg-white text-black hover:bg-white/90"
                onClick={() => onOpenChange(false)}
              >
                {m.year_review_story_details()}
              </Button>
            </>
          ) : (
            <Button
              aria-label={
                isPaused
                  ? m.year_review_story_play()
                  : m.year_review_story_pause()
              }
              className="text-white hover:bg-white/15"
              onClick={() => setIsPaused((paused) => !paused)}
              size="icon-sm"
              variant="ghost"
            >
              {isPaused ? <RiPlayFill /> : <RiPauseFill />}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
