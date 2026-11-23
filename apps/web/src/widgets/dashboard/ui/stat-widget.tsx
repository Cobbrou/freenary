import type { StatMetric } from "@freenary/api/dashboards/widgets";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { Elevated } from "@freenary/ui/lib/elevated";
import { useId } from "react";
import type { ReactNode } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { formatCurrency } from "@/shared/lib/format-currency";

import { availableToSpend, spendingPace } from "../model/finance";
import type { CashFlow } from "../model/finance";
import {
  untilBudgetMonthKnown,
  useBudgetMonth,
  useMonthCashFlows,
  useOverview,
  useRecurring,
} from "../model/queries";
import type { WidgetQuery } from "../model/widget-query";
import { HeadlineAmount, WidgetCaption, WidgetError } from "./widget-card";
import type { CaptionTone } from "./widget-card";

interface StatWidgetProps {
  metric: StatMetric;
  title?: string;
  today: Date;
}

interface StatValue {
  caption: string;
  tone: CaptionTone;
  value: string;
}

interface StatCardProps {
  errorMessage: string;
  label: string;
  query: WidgetQuery<StatValue | null>;
}

const SHARE_FORMAT: Intl.NumberFormatOptions = {
  maximumFractionDigits: 0,
  style: "percent",
};

const DAY_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
};

const STAT_LABELS = {
  available_to_spend: m.home_available_title,
  current_accounts: m.home_balance_title,
  income_this_month: m.widget_stat_income_title,
  net_worth: m.home_net_worth_title,
  saved_this_month: m.widget_stat_saved_title,
  spent_this_month: m.home_spent_title,
} satisfies Record<StatMetric, () => string>;

const mapQuery = <T, U>(
  query: WidgetQuery<T>,
  read: (data: T) => U
): WidgetQuery<U> => ({
  ...query,
  data: query.data === undefined ? undefined : read(query.data),
});

const bothQueries = <A, B>(
  first: WidgetQuery<A>,
  second: WidgetQuery<B>
): WidgetQuery<[A, B]> => ({
  data:
    first.data === undefined || second.data === undefined
      ? undefined
      : [first.data, second.data],
  handleRetry: () => {
    first.handleRetry();
    second.handleRetry();
  },
  isError: first.isError || second.isError,
  isPending: first.isPending || second.isPending,
  isRetrying: first.isRetrying || second.isRetrying,
});

const incomingOf = ({ periods }: CashFlow): number =>
  periods.reduce((total, period) => total + period.incoming, 0);

const outgoingOf = ({ periods }: CashFlow): number =>
  periods.reduce((total, period) => total + period.outgoing, 0);

const StatCard = ({ errorMessage, label, query }: StatCardProps) => {
  const labelId = useId();

  let body: ReactNode = null;

  if (query.isPending) {
    body = (
      <div aria-busy="true" className="flex flex-col gap-2">
        <output className="sr-only">{m.widget_stat_loading({ label })}</output>
        <div aria-hidden="true" className="flex flex-col gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-44 max-w-full" />
        </div>
      </div>
    );
  } else if (query.isError) {
    body = (
      <WidgetError
        isRetrying={query.isRetrying}
        message={errorMessage}
        onRetry={query.handleRetry}
      />
    );
  } else if (query.data === null) {
    body = <WidgetCaption>{m.widget_stat_unavailable()}</WidgetCaption>;
  } else if (query.data) {
    body = (
      <div className="flex flex-col gap-1">
        <HeadlineAmount>{query.data.value}</HeadlineAmount>
        <WidgetCaption tone={query.data.tone}>
          {query.data.caption}
        </WidgetCaption>
      </div>
    );
  }

  return (
    <Elevated className="h-full min-w-0 rounded-xl" offset={1}>
      <section
        aria-labelledby={labelId}
        className="bg-card text-card-foreground flex h-full flex-col gap-2 rounded-xl border p-4"
      >
        <h3 className="text-muted-foreground text-sm" id={labelId}>
          {label}
        </h3>
        {body}
      </section>
    </Elevated>
  );
};

const SpentStat = ({ label, today }: { label: string; today: Date }) => {
  const { current, previous, rule } = useMonthCashFlows(today);

  const query = mapQuery(
    bothQueries(current, previous),
    ([now, before]): StatValue => {
      const pace = spendingPace(now.periods, before.periods, today, rule);
      const difference = pace.currentToDateMinor - pace.previousToDateMinor;
      const amount = formatCurrency(Math.abs(difference), now.currency);
      const caption =
        difference > 0
          ? m.home_spent_more({ amount })
          : m.home_spent_less({ amount });

      return {
        caption: difference === 0 ? m.home_spent_same() : caption,
        tone: difference > 0 ? "negative" : "positive",
        value: formatCurrency(pace.monthTotalMinor, now.currency),
      };
    }
  );

  return (
    <StatCard errorMessage={m.home_spent_error()} label={label} query={query} />
  );
};

const IncomeStat = ({ label, today }: { label: string; today: Date }) => {
  const { current, previous } = useMonthCashFlows(today);

  const query = mapQuery(
    bothQueries(current, previous),
    ([now, before]): StatValue => ({
      caption: m.widget_stat_income_caption({
        amount: formatCurrency(incomingOf(before), before.currency),
      }),
      tone: "neutral",
      value: formatCurrency(incomingOf(now), now.currency),
    })
  );

  return (
    <StatCard
      errorMessage={m.widget_stat_income_error()}
      label={label}
      query={query}
    />
  );
};

const SavedStat = ({ label, today }: { label: string; today: Date }) => {
  const { current } = useMonthCashFlows(today);

  const query = mapQuery(current, (now): StatValue => {
    const incoming = incomingOf(now);
    const savedMinor = incoming - outgoingOf(now);

    if (savedMinor < 0) {
      return {
        caption: m.widget_stat_saved_short({
          amount: formatCurrency(-savedMinor, now.currency),
        }),
        tone: "negative",
        value: formatCurrency(savedMinor, now.currency),
      };
    }

    return {
      caption:
        incoming > 0
          ? m.widget_stat_saved_share({
              share: new Intl.NumberFormat(getLocale(), SHARE_FORMAT).format(
                savedMinor / incoming
              ),
            })
          : m.widget_stat_saved_no_income(),
      tone: "positive",
      value: formatCurrency(savedMinor, now.currency),
    };
  });

  return (
    <StatCard
      errorMessage={m.widget_stat_saved_error()}
      label={label}
      query={query}
    />
  );
};

const AvailableStat = ({ label, today }: { label: string; today: Date }) => {
  const { isKnown, rule } = useBudgetMonth();
  const recurringQuery = untilBudgetMonthKnown(useRecurring(), isKnown);
  const query = mapQuery(recurringQuery, (recurring): StatValue | null => {
    const available = availableToSpend(recurring, today, rule);

    if (available === null) {
      return null;
    }

    const date = available.monthEnd.toLocaleDateString(getLocale(), DAY_FORMAT);

    return {
      caption: m.widget_stat_available_caption({
        count: available.billCount,
        date,
      }),
      tone: available.availableMinor < 0 ? "negative" : "neutral",
      value: formatCurrency(available.availableMinor, recurring.currency),
    };
  });

  return (
    <StatCard
      errorMessage={m.home_available_error()}
      label={label}
      query={query}
    />
  );
};

const CurrentAccountsStat = ({ label }: { label: string }) => {
  const query = mapQuery(
    useOverview(),
    ({ currentAccounts }): StatValue | null =>
      currentAccounts.balanceMinor === null
        ? null
        : {
            caption: currentAccounts.balancesAt
              ? m.home_balance_updated({
                  date: new Date(currentAccounts.balancesAt).toLocaleDateString(
                    getLocale(),
                    DAY_FORMAT
                  ),
                })
              : "",
            tone: "neutral",
            value: formatCurrency(
              currentAccounts.balanceMinor,
              currentAccounts.currency
            ),
          }
  );

  return (
    <StatCard
      errorMessage={m.home_balance_error()}
      label={label}
      query={query}
    />
  );
};

const NetWorthStat = ({ label }: { label: string }) => {
  const query = mapQuery(
    useOverview(),
    ({ accounts, currency, netWorth }): StatValue | null =>
      netWorth.netWorthMinor === null
        ? null
        : {
            caption:
              netWorth.liabilitiesMinor > 0
                ? m.home_net_worth_assets_and_debts({
                    assets: formatCurrency(netWorth.assetsMinor, currency),
                    debts: formatCurrency(netWorth.liabilitiesMinor, currency),
                  })
                : m.widget_stat_net_worth_caption({ count: accounts.length }),
            tone: "neutral",
            value: formatCurrency(netWorth.netWorthMinor, currency),
          }
  );

  return (
    <StatCard
      errorMessage={m.home_net_worth_error()}
      label={label}
      query={query}
    />
  );
};

const STAT_VIEWS = {
  available_to_spend: AvailableStat,
  current_accounts: CurrentAccountsStat,
  income_this_month: IncomeStat,
  net_worth: NetWorthStat,
  saved_this_month: SavedStat,
  spent_this_month: SpentStat,
} satisfies Record<
  StatMetric,
  (props: { label: string; today: Date }) => ReactNode
>;

export const StatWidget = ({ metric, title, today }: StatWidgetProps) => {
  const View = STAT_VIEWS[metric];

  return <View label={title ?? STAT_LABELS[metric]()} today={today} />;
};
