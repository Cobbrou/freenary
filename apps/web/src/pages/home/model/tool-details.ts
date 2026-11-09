import { isAssistantToolName } from "@freenary/api/assistant/tools";
import type { AssistantToolName } from "@freenary/api/assistant/tools";
import { AGGREGATION_MODES } from "@freenary/api/lib/aggregation";
import {
  CATEGORY_GROUPS,
  SPENDING_CATEGORIES,
} from "@freenary/api/lib/taxonomy";
import type { ToolUIPart } from "ai";
import { z } from "zod";

import { categoryGroupLabel, categoryLabel } from "@/entities/category";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

import { TOOL_PART_TYPE_PREFIX } from "./execution";

export interface ToolParameter {
  label: string;
  value: string;
}

const TOOL_PURPOSES = {
  get_accounts_overview: m.assistant_tool_accounts_purpose,
  get_budget_vs_actual: m.assistant_tool_budget_vs_actual_purpose,
  get_cash_flow: m.assistant_tool_cash_flow_purpose,
  get_fixed_vs_variable: m.assistant_tool_fixed_vs_variable_purpose,
  get_recurring_expenses: m.assistant_tool_recurring_purpose,
  get_spending_by_group: m.assistant_tool_spending_purpose,
  search_transactions: m.assistant_tool_transactions_purpose,
} satisfies Record<AssistantToolName, () => string>;

const toolInputSchema = z.looseObject({
  aggregation: z.enum(AGGREGATION_MODES).optional(),
  categories: z.array(z.enum(SPENDING_CATEGORIES)).optional(),
  direction: z.enum(["incoming", "outgoing"]).optional(),
  from: z.string().optional(),
  groups: z.array(z.enum(CATEGORY_GROUPS)).optional(),
  limit: z.number().optional(),
  search: z.string().optional(),
  sort: z.enum(["date", "amount"]).optional(),
  to: z.string().optional(),
});

type ToolInput = z.infer<typeof toolInputSchema>;

const toolOutputSchema = z.looseObject({
  accounts: z.array(z.unknown()).optional(),
  categories: z.array(z.unknown()).optional(),
  expenses: z.array(z.unknown()).optional(),
  periods: z.array(z.unknown()).optional(),
  transactions: z.array(z.unknown()).optional(),
});

type ToolOutput = z.infer<typeof toolOutputSchema>;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/u;

const AGGREGATION_LABELS = {
  average: m.budget_aggregation_average,
  median: m.budget_aggregation_median,
  total: m.budget_aggregation_total,
} satisfies Record<NonNullable<ToolInput["aggregation"]>, () => string>;

const DIRECTION_LABELS = {
  incoming: m.assistant_param_incoming,
  outgoing: m.assistant_param_outgoing,
} satisfies Record<NonNullable<ToolInput["direction"]>, () => string>;

const SORT_LABELS = {
  amount: m.budget_sort_amount,
  date: m.budget_sort_date,
} satisfies Record<NonNullable<ToolInput["sort"]>, () => string>;

const ROW_COUNT_MESSAGES = {
  accounts: m.assistant_result_accounts,
  categories: m.assistant_result_categories,
  expenses: m.assistant_result_recurring,
  periods: m.assistant_result_periods,
  transactions: m.assistant_result_transactions,
} satisfies Record<keyof ToolOutput, (inputs: { count: number }) => string>;

const RESULT_SUMMARIES = {
  get_accounts_overview: ({ accounts }: ToolOutput) =>
    accounts && ROW_COUNT_MESSAGES.accounts({ count: accounts.length }),
  get_budget_vs_actual: ({ categories }: ToolOutput) =>
    categories && ROW_COUNT_MESSAGES.categories({ count: categories.length }),
  get_cash_flow: ({ periods }: ToolOutput) =>
    periods && ROW_COUNT_MESSAGES.periods({ count: periods.length }),
  get_fixed_vs_variable: () => m.assistant_result_figures(),
  get_recurring_expenses: ({ expenses }: ToolOutput) =>
    expenses && ROW_COUNT_MESSAGES.expenses({ count: expenses.length }),
  get_spending_by_group: ({ categories }: ToolOutput) =>
    categories && ROW_COUNT_MESSAGES.categories({ count: categories.length }),
  search_transactions: ({ transactions }: ToolOutput) =>
    transactions &&
    ROW_COUNT_MESSAGES.transactions({ count: transactions.length }),
} satisfies Record<
  AssistantToolName,
  (output: ToolOutput) => string | undefined
>;

export const assistantToolNameOf = (
  partType: string
): AssistantToolName | null => {
  const name = partType.startsWith(TOOL_PART_TYPE_PREFIX)
    ? partType.slice(TOOL_PART_TYPE_PREFIX.length)
    : partType;

  return isAssistantToolName(name) ? name : null;
};

export const assistantToolPurpose = (partType: string): string | undefined => {
  const name = assistantToolNameOf(partType);

  return name ? TOOL_PURPOSES[name]() : undefined;
};

const formatDay = (value: string): string => {
  const shapedAsIsoDay = ISO_DAY.test(value)
    ? new Date(`${value}T00:00:00`)
    : null;

  if (shapedAsIsoDay === null || Number.isNaN(shapedAsIsoDay.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium" }).format(
    shapedAsIsoDay
  );
};

const listOf = (labels: string[]): string =>
  new Intl.ListFormat(getLocale(), { type: "conjunction" }).format(labels);

export const toolParametersOf = (
  input: ToolUIPart["input"]
): ToolParameter[] => {
  const parsed = toolInputSchema.safeParse(input);

  if (!parsed.success) {
    return [];
  }

  const {
    aggregation,
    categories,
    direction,
    from,
    groups,
    limit,
    search,
    sort,
    to,
  } = parsed.data;

  const rows: (ToolParameter | null)[] = [
    from ? { label: m.assistant_param_from(), value: formatDay(from) } : null,
    to ? { label: m.assistant_param_to(), value: formatDay(to) } : null,
    aggregation
      ? {
          label: m.assistant_param_aggregation(),
          value: AGGREGATION_LABELS[aggregation](),
        }
      : null,
    direction
      ? {
          label: m.assistant_param_direction(),
          value: DIRECTION_LABELS[direction](),
        }
      : null,
    groups && groups.length > 0
      ? {
          label: m.assistant_param_groups(),
          value: listOf(groups.map(categoryGroupLabel)),
        }
      : null,
    categories && categories.length > 0
      ? {
          label: m.assistant_param_categories(),
          value: listOf(categories.map(categoryLabel)),
        }
      : null,
    search ? { label: m.assistant_param_search(), value: search } : null,
    sort
      ? { label: m.assistant_param_sort(), value: SORT_LABELS[sort]() }
      : null,
    limit === undefined
      ? null
      : { label: m.assistant_param_limit(), value: String(limit) },
  ];

  return rows.filter((row) => row !== null);
};

export const toolResultSummary = (part: ToolUIPart): string | undefined => {
  const parsed = toolOutputSchema.safeParse(part.output);
  const name = assistantToolNameOf(part.type);

  if (!parsed.success || name === null) {
    return undefined;
  }

  return RESULT_SUMMARIES[name](parsed.data);
};
