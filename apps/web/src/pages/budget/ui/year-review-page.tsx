import { Button } from "@freenary/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@freenary/ui/components/empty";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@freenary/ui/components/select";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { cn } from "@freenary/ui/lib/utils";
import { RiSparkling2Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { Play } from "kubai-icons-react";
import { useState } from "react";

import { m } from "@/paraglide/messages.js";
import { orpc } from "@/shared/api";
import { useNow } from "@/shared/lib/calendar-day";
import { formatCurrency } from "@/shared/lib/format-currency";
import { LoadError } from "@/shared/ui/load-error";
import { UnconvertedNote } from "@/shared/ui/unconverted-note";

import { changeOf, comparisonOf, isPartialYear } from "../model/year-review";
import type { YearFigures, YearReview } from "../model/year-review";
import { dayLabel, formatChange, formatShare } from "./year-review-format";
import {
  CategoriesSection,
  MerchantsSection,
  MonthsSection,
  NetWorthSection,
  RecurringSection,
} from "./year-review-sections";
import { YearReviewStory } from "./year-review-story";

const route = getRouteApi("/_auth/year-in-review");

const Kpi = ({
  change,
  hint,
  label,
  tone,
  value,
}: {
  change: string | null;
  hint?: string;
  label: string;
  tone?: string;
  value: string;
}) => (
  <div className="bg-card flex min-w-0 flex-col gap-1 rounded-xl border p-4 shadow-xs">
    <span className="text-muted-foreground text-sm">{label}</span>
    <span className={cn("text-2xl font-semibold tabular-nums", tone)}>
      {value}
    </span>
    {change !== null && (
      <span className="text-muted-foreground text-xs">{change}</span>
    )}
    {hint !== undefined && (
      <span className="text-muted-foreground text-xs text-pretty">{hint}</span>
    )}
  </div>
);

const changeText = (
  review: YearReview,
  pick: (figures: YearFigures) => number | null
): string | null => {
  if (review.previous === null) {
    return null;
  }

  const current = pick(review.current);
  const previous = pick(review.previous);

  if (current === null || previous === null) {
    return null;
  }

  const change = changeOf(current, previous);

  return change === null
    ? null
    : m.year_review_change({
        change: formatChange(change),
        year: String(review.year - 1),
      });
};

const KpiGrid = ({ review }: { review: YearReview }) => {
  const { currency, current } = review;
  const money = (amount: number) => formatCurrency(amount, currency);

  return (
    <div className="grid grid-cols-1 gap-4 @md/review:grid-cols-2 @4xl/review:grid-cols-4">
      <Kpi
        change={changeText(review, (figures) => figures.incomeMinor)}
        label={m.year_review_income()}
        value={money(current.incomeMinor)}
      />
      <Kpi
        change={changeText(review, (figures) => figures.expensesMinor)}
        label={m.year_review_expenses()}
        value={money(current.expensesMinor)}
      />
      <Kpi
        change={changeText(review, (figures) => figures.netMinor)}
        label={m.year_review_net()}
        tone={current.netMinor >= 0 ? "text-success" : "text-destructive"}
        value={money(current.netMinor)}
      />
      <Kpi
        change={null}
        hint={m.year_review_savings_rate_hint()}
        label={m.year_review_savings_rate()}
        value={
          current.savingsRate === null ? "—" : formatShare(current.savingsRate)
        }
      />
    </div>
  );
};

const ReviewNotes = ({ now, review }: { now: Date; review: YearReview }) => {
  const comparison = comparisonOf(review);
  const notes = [
    review.basis === "calendar"
      ? m.year_review_basis_calendar()
      : m.year_review_basis_budget_months({
          from: dayLabel(review.from),
          to: dayLabel(review.to),
        }),
  ];

  if (new Date(review.to) > now) {
    notes.push(m.year_review_in_progress());
  } else if (isPartialYear(review)) {
    notes.push(m.year_review_partial({ count: review.current.monthsWithData }));
  }

  if (comparison === "none") {
    notes.push(m.year_review_compare_none({ year: String(review.year - 1) }));
  } else if (comparison === "partial") {
    notes.push(m.year_review_compare_partial());
  }

  return (
    <div className="flex flex-col gap-1">
      {notes.map((note) => (
        <p className="text-muted-foreground text-sm text-pretty" key={note}>
          {note}
        </p>
      ))}
      <UnconvertedNote counts={{ transactions: review.unconvertedCount }} />
    </div>
  );
};

const YearPicker = ({
  onChange,
  year,
  years,
}: {
  onChange: (year: number) => void;
  year: number;
  years: readonly number[];
}) => (
  <Select
    onValueChange={(next) => onChange(Number(next))}
    size="compact"
    value={String(year)}
  >
    <SelectTrigger
      aria-label={m.year_review_year_label()}
      className="border-white/30 bg-white/15 text-white"
    />
    <SelectContent>
      <SelectGroup>
        {years.map((entry, index) => (
          <SelectItem index={index} key={entry} value={String(entry)}>
            {String(entry)}
          </SelectItem>
        ))}
      </SelectGroup>
    </SelectContent>
  </Select>
);

const Hero = ({
  onPlay,
  onYearChange,
  review,
  years,
}: {
  onPlay: () => void;
  onYearChange: (year: number) => void;
  review: YearReview;
  years: readonly number[];
}) => (
  <section className="relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-linear-to-br from-fuchsia-700 via-violet-700 to-indigo-700 p-6 text-white">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-white/80">{m.nav_year_review()}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
          {m.year_review_title({ year: String(review.year) })}
        </h1>
      </div>
      {years.length > 1 && (
        <YearPicker onChange={onYearChange} year={review.year} years={years} />
      )}
    </div>
    <p className="text-4xl font-semibold tracking-tight tabular-nums">
      {formatCurrency(review.current.expensesMinor, review.currency)}
    </p>
    <div>
      <Button leadingIcon={Play} onClick={onPlay}>
        {m.year_review_play()}
      </Button>
    </div>
  </section>
);

const ReviewMessage = ({
  description,
  title,
}: {
  description: string;
  title: string;
}) => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <RiSparkling2Line />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
  </Empty>
);

export const YearReviewPage = () => {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const now = useNow();
  const [storyRun, setStoryRun] = useState(0);
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const query = useQuery(
    orpc.budget.getYearInReview.queryOptions({ input: { year: search.year } })
  );

  if (query.isPending) {
    return (
      <div aria-busy="true" className="flex flex-1 flex-col gap-4 p-4">
        <span className="sr-only">{m.year_review_loading()}</span>
        <Skeleton aria-hidden="true" className="h-56 rounded-2xl" />
        <Skeleton aria-hidden="true" className="h-28" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <LoadError
        isRetrying={query.isFetching}
        onRetry={() => {
          void query.refetch();
        }}
        title={m.year_review_load_error()}
      />
    );
  }

  const { featuredYear, review, years } = query.data;

  if (featuredYear === null) {
    return (
      <ReviewMessage
        description={m.year_review_closed_description()}
        title={m.year_review_closed_title()}
      />
    );
  }

  if (review === null) {
    return (
      <ReviewMessage
        description={m.year_review_no_data_description({
          year: String(search.year ?? featuredYear),
        })}
        title={m.year_review_no_data_title()}
      />
    );
  }

  return (
    <div className="@container/review mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
      <Hero
        onPlay={() => {
          setStoryRun((run) => run + 1);
          setIsStoryOpen(true);
        }}
        onYearChange={(year) => {
          void navigate({ search: { year } });
        }}
        review={review}
        years={years}
      />
      <ReviewNotes now={now} review={review} />
      <KpiGrid review={review} />
      <div className="grid grid-cols-1 gap-4 @3xl/review:grid-cols-2">
        <MonthsSection review={review} />
        <CategoriesSection review={review} />
        <MerchantsSection review={review} />
        <RecurringSection review={review} />
      </div>
      <NetWorthSection review={review} />
      <YearReviewStory
        key={storyRun}
        onOpenChange={setIsStoryOpen}
        open={isStoryOpen}
        review={review}
      />
    </div>
  );
};
