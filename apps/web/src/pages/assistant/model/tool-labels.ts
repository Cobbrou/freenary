import type { AssistantToolName } from "@freenary/api/assistant/tools";

import { m } from "@/paraglide/messages.js";

import { assistantToolNameOf } from "./tool-details";

const ASSISTANT_TOOL_MESSAGES = {
  get_accounts_overview: m.assistant_tool_accounts,
  get_budget_vs_actual: m.assistant_tool_budget_vs_actual,
  get_cash_flow: m.assistant_tool_cash_flow,
  get_fixed_vs_variable: m.assistant_tool_fixed_vs_variable,
  get_recurring_expenses: m.assistant_tool_recurring,
  get_spending_by_group: m.assistant_tool_spending,
  save_dashboard: m.assistant_tool_dashboard,
  search_transactions: m.assistant_tool_transactions,
} satisfies Record<AssistantToolName, () => string>;

export const assistantToolLabel = (partType: string): string => {
  const name = assistantToolNameOf(partType);

  return name === null
    ? m.assistant_tool_unknown()
    : ASSISTANT_TOOL_MESSAGES[name]();
};
