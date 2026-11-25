import { cn } from "@freenary/ui/lib/utils";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

export type UnconvertedSubject =
  | "accounts"
  | "balances"
  | "holdings"
  | "payments"
  | "transactions";

const SUBJECT_ORDER = [
  "transactions",
  "payments",
  "balances",
  "accounts",
  "holdings",
] as const satisfies readonly UnconvertedSubject[];

const SUBJECT_MESSAGES = {
  accounts: m.unconverted_accounts,
  balances: m.unconverted_balances,
  holdings: m.unconverted_holdings,
  payments: m.unconverted_payments,
  transactions: m.unconverted_transactions,
} satisfies Record<UnconvertedSubject, (input: { count: number }) => string>;

export const unconvertedSentences = (
  counts: Partial<Record<UnconvertedSubject, number>>,
  currencies: readonly string[] = []
): string[] => {
  const sentences = SUBJECT_ORDER.flatMap((subject) => {
    const count = counts[subject] ?? 0;

    return count > 0 ? [SUBJECT_MESSAGES[subject]({ count })] : [];
  });

  if (currencies.length > 0) {
    sentences.push(
      m.unconverted_currencies({
        currencies: new Intl.ListFormat(getLocale(), {
          type: "conjunction",
        }).format(currencies),
      })
    );
  }

  return sentences;
};

export const UnconvertedNote = ({
  className,
  counts,
  currencies,
}: {
  className?: string;
  counts: Partial<Record<UnconvertedSubject, number>>;
  currencies?: readonly string[];
}) => {
  const sentences = unconvertedSentences(counts, currencies);

  if (sentences.length === 0) {
    return null;
  }

  return (
    <p className={cn("text-muted-foreground text-xs text-pretty", className)}>
      {sentences.join(" ")}
    </p>
  );
};
