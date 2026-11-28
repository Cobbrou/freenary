import type { AppRouter } from "@freenary/api/routers/index";
import type { InferRouterOutputs } from "@orpc/server";
import { z } from "zod";

type YearReviewOutput =
  InferRouterOutputs<AppRouter>["budget"]["getYearInReview"];

export type YearReview = NonNullable<YearReviewOutput["review"]>;

export type YearFigures = YearReview["current"];

export type MerchantYear = YearReview["merchants"]["byAmount"][number];

export type Comparison = "full" | "none" | "partial";

export type StorySlide =
  | { kind: "intro"; year: number }
  | { change: number | null; expensesMinor: number; kind: "spent" }
  | {
      amountMinor: number;
      category: YearReview["categories"][number]["category"];
      kind: "category";
      share: number;
    }
  | { kind: "merchant"; merchant: MerchantYear }
  | { kind: "regular"; merchant: MerchantYear }
  | { kind: "month"; month: string; outgoingMinor: number }
  | {
      expense: NonNullable<YearReview["largestExpense"]>;
      kind: "largest";
    }
  | { kind: "recurring"; merchantCount: number; totalMinor: number }
  | { kind: "saved"; savedMinor: number; savingsRate: number }
  | { changeMinor: number; endMinor: number; kind: "net-worth" }
  | { kind: "outro"; year: number };

const MONTHS_IN_A_YEAR = 12;

export const changeOf = (current: number, previous: number): number | null =>
  previous > 0 ? (current - previous) / previous : null;

export const comparisonOf = (review: YearReview): Comparison => {
  if (review.previous === null) {
    return "none";
  }

  return review.current.monthsWithData < MONTHS_IN_A_YEAR ||
    review.previous.monthsWithData < MONTHS_IN_A_YEAR
    ? "partial"
    : "full";
};

export const isPartialYear = (review: YearReview): boolean =>
  review.current.monthsWithData < MONTHS_IN_A_YEAR;

export const priciestMonthOf = (months: YearReview["months"]) => {
  let priciest: YearReview["months"][number] | null = null;

  for (const month of months) {
    if (month.outgoingMinor > (priciest?.outgoingMinor ?? 0)) {
      priciest = month;
    }
  }

  return priciest;
};

export const netWorthChangeOf = (points: YearReview["netWorth"]["points"]) => {
  const [first] = points;
  const last = points.at(-1);

  return first && last && points.length > 1
    ? {
        changeMinor: last.balanceMinor - first.balanceMinor,
        endMinor: last.balanceMinor,
        startMinor: first.balanceMinor,
      }
    : null;
};

export const merchantKeyName = (merchant: {
  merchantKey: string | null;
  merchantName: string | null;
}): string => merchant.merchantName ?? merchant.merchantKey ?? "";

export const storySlides = (review: YearReview): StorySlide[] => {
  const { current, previous, year } = review;
  const slides: StorySlide[] = [{ kind: "intro", year }];

  if (current.expensesMinor > 0) {
    slides.push({
      change:
        comparisonOf(review) === "full" && previous
          ? changeOf(current.expensesMinor, previous.expensesMinor)
          : null,
      expensesMinor: current.expensesMinor,
      kind: "spent",
    });
  }

  const [topCategory] = review.categories;

  if (topCategory && topCategory.amountMinor > 0) {
    slides.push({
      amountMinor: topCategory.amountMinor,
      category: topCategory.category,
      kind: "category",
      share: topCategory.amountMinor / current.expensesMinor,
    });
  }

  const [topMerchant] = review.merchants.byAmount;
  const [regular] = review.merchants.byCount;

  if (topMerchant) {
    slides.push({ kind: "merchant", merchant: topMerchant });
  }

  if (regular && regular.merchantKey !== topMerchant?.merchantKey) {
    slides.push({ kind: "regular", merchant: regular });
  }

  const priciest = priciestMonthOf(review.months);

  if (priciest) {
    slides.push({
      kind: "month",
      month: priciest.month,
      outgoingMinor: priciest.outgoingMinor,
    });
  }

  if (review.largestExpense) {
    slides.push({ expense: review.largestExpense, kind: "largest" });
  }

  if (review.recurring.totalMinor > 0) {
    slides.push({
      kind: "recurring",
      merchantCount: review.recurring.merchantCount,
      totalMinor: review.recurring.totalMinor,
    });
  }

  if (current.savingsRate !== null) {
    slides.push({
      kind: "saved",
      savedMinor: current.netMinor + current.savedMinor,
      savingsRate: current.savingsRate,
    });
  }

  const netWorth = netWorthChangeOf(review.netWorth.points);

  if (netWorth) {
    slides.push({
      changeMinor: netWorth.changeMinor,
      endMinor: netWorth.endMinor,
      kind: "net-worth",
    });
  }

  slides.push({ kind: "outro", year });

  return slides;
};

export const yearReviewSearchSchema = z.object({
  year: z
    .unknown()
    .transform((raw) => z.number().int().safeParse(raw).data)
    .optional(),
});

export const STORY_SLIDE_MS = 6000;

export const STORY_TICK_MS = 100;

export interface StoryState {
  elapsedMs: number;
  index: number;
}

export type StoryAction =
  | { kind: "go"; last: number; step: -1 | 1 }
  | { kind: "restart" }
  | { kind: "tick"; last: number };

export const STORY_START: StoryState = { elapsedMs: 0, index: 0 };

export const storyReducer = (
  state: StoryState,
  action: StoryAction
): StoryState => {
  if (action.kind === "restart") {
    return STORY_START;
  }

  if (action.kind === "go") {
    return {
      elapsedMs: 0,
      index: Math.min(Math.max(state.index + action.step, 0), action.last),
    };
  }

  if (state.index >= action.last) {
    return state;
  }

  const elapsedMs = state.elapsedMs + STORY_TICK_MS;

  return elapsedMs >= STORY_SLIDE_MS
    ? { elapsedMs: 0, index: state.index + 1 }
    : { ...state, elapsedMs };
};
