import { assistantUiPrompt } from "./ui";

export interface AssistantPromptAccounts {
  firstTransactionDate: Date | string | null;
  lastTransactionDate: Date | string | null;
  hasAccounts: boolean;
}

const DATA_RANGE_UNAVAILABLE = "No bank account is connected yet.";

const isoDay = (date: Date | string | null): string | null =>
  date === null ? null : new Date(date).toISOString().slice(0, 10);

export const assistantSystemPrompt = (
  accounts: AssistantPromptAccounts,
  locale: string
): string => {
  const { hasAccounts } = accounts;
  const firstTransactionDate = isoDay(accounts.firstTransactionDate);
  const lastTransactionDate = isoDay(accounts.lastTransactionDate);
  const today = new Date().toISOString().slice(0, 10);
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
    assistantUiPrompt(),
  ].join("\n");
};
