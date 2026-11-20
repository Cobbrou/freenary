import type { DashboardWidget } from "../dashboards/widgets";
import type { AppRouterClient } from "../routers/index";
import { assistantUiPrompt } from "./ui";

export interface AssistantPromptAccounts {
  firstTransactionDate: Date | string | null;
  lastTransactionDate: Date | string | null;
  hasAccounts: boolean;
}

export interface AssistantPromptDashboard {
  id: string;
  title: string;
}

export interface AssistantPromptDashboards {
  focused?: AssistantPromptDashboard & { widgets: DashboardWidget[] };
  saved: AssistantPromptDashboard[];
}

const NO_DASHBOARDS: AssistantPromptDashboards = { saved: [] };

const DASHBOARDS_LISTED = 10;

const DATA_RANGE_UNAVAILABLE = "No bank account is connected yet.";

export const promptDashboards = async (
  api: AppRouterClient,
  focusedId: string | undefined
): Promise<AssistantPromptDashboards> => {
  const { dashboards } = await api.dashboards.list();
  const focusedIsOwned = dashboards.some(
    (dashboard) => dashboard.id === focusedId
  );

  const focused =
    focusedId !== undefined && focusedIsOwned
      ? await api.dashboards.get({ dashboardId: focusedId })
      : undefined;

  return {
    focused:
      focused === undefined
        ? undefined
        : { id: focused.id, title: focused.title, widgets: focused.widgets },
    saved: dashboards.map(({ id, title }) => ({ id, title })),
  };
};

const isoDay = (date: Date | string | null): string | null =>
  date === null ? null : new Date(date).toISOString().slice(0, 10);

export const localDay = (date: Date): string =>
  [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

const dashboardsPrompt = ({
  focused,
  saved,
}: AssistantPromptDashboards): string[] => {
  const listed = saved
    .slice(0, DASHBOARDS_LISTED)
    .map((dashboard) => `- ${dashboard.id}: ${dashboard.title}`);

  return [
    "## Dashboards",
    "",
    "A dashboard is a page of widgets that read the user's live data. When the user asks for a dashboard, or to turn an answer into one, call save_dashboard with a short title in the user's language and the widgets that answer the need. To change a dashboard, call save_dashboard with its dashboardId and the whole new widget list, and leave the title out unless the user asks for a new name. Then say in one sentence what the dashboard shows.",
    ...(listed.length > 0
      ? ["", "The user's dashboards, by id:", ...listed]
      : []),
    ...(focused
      ? [
          "",
          `The user is looking at the dashboard "${focused.title}" (dashboardId ${focused.id}). A request to change, add or remove something is about it. Its widgets now: ${JSON.stringify(focused.widgets)}`,
        ]
      : []),
  ];
};

export const assistantSystemPrompt = (
  accounts: AssistantPromptAccounts,
  locale: string,
  today: string,
  dashboards: AssistantPromptDashboards = NO_DASHBOARDS
): string => {
  const { hasAccounts } = accounts;
  const firstTransactionDate = isoDay(accounts.firstTransactionDate);
  const lastTransactionDate = isoDay(accounts.lastTransactionDate);
  const range =
    hasAccounts && firstTransactionDate && lastTransactionDate
      ? `Transaction data covers ${firstTransactionDate} to ${lastTransactionDate}; refuse periods outside it instead of extrapolating.`
      : DATA_RANGE_UNAVAILABLE;

  return [
    "You are Freenary's financial assistant. Freenary holds this user's bank accounts, transactions and budget plan.",
    `Answer in the user's language: ${locale}.`,
    `Today is ${today}.`,
    "Never state a figure you did not get from a tool. Call the tools, then answer from their results.",
    "Amounts in tool results are already decimal figures in the currency each result names — quote them as given and never rescale them.",
    'Categories come back as stable slugs such as "rent-mortgage" or "transport-travel", and each one sits in the "income", "investments" or "spending" section; name them naturally in the user\'s language, never as a slug.',
    range,
    "If no bank account is connected, say so and point the user to Settings → Bank accounts.",
    "Be brief: two or three sentences, then the numbers that support them.",
    "You provide information and arithmetic, never regulated financial advice.",
    "",
    ...dashboardsPrompt(dashboards),
    "",
    assistantUiPrompt(),
  ].join("\n");
};
