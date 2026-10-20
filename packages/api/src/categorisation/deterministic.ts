import { categoryFromMcc } from "../lib/mcc-categories";
import { categoryDirection } from "../lib/taxonomy";
import type { SpendingCategory } from "../lib/taxonomy";
import type { KeywordTables } from "./keywords";
import { keywordsFor, matchKeyword } from "./keywords";
import type {
  CategoriseInput,
  OutgoingNegativeMinorUnits,
  ResolutionStage,
} from "./types";

export interface DeterministicResult {
  category: SpendingCategory;
  confidence: number;
  stage: ResolutionStage;
}

const MCC_CONFIDENCE = 0.8;
const RULE_CONFIDENCE = 0.75;

export const readsAsRefund = (
  category: SpendingCategory,
  amountMinor: OutgoingNegativeMinorUnits
): boolean => amountMinor > 0 && categoryDirection(category) === "out";

const accepted = (
  category: SpendingCategory | null,
  amountMinor: OutgoingNegativeMinorUnits,
  confidence: number,
  stage: ResolutionStage
): DeterministicResult | null => {
  if (!category || readsAsRefund(category, amountMinor)) {
    return null;
  }

  return { category, confidence, stage };
};

const ruleHit = (
  table: KeywordTables["bankCode"],
  text: string | undefined,
  amountMinor: OutgoingNegativeMinorUnits
): DeterministicResult | null =>
  text
    ? accepted(matchKeyword(table, text), amountMinor, RULE_CONFIDENCE, "rules")
    : null;

export const deterministicCategory = (
  input: CategoriseInput
): DeterministicResult | null => {
  const { amountMinor, bankTransactionCode, country, merchantCategoryCode } =
    input;

  const byMcc = merchantCategoryCode
    ? accepted(
        categoryFromMcc(merchantCategoryCode),
        amountMinor,
        MCC_CONFIDENCE,
        "mcc"
      )
    : null;

  if (byMcc) {
    return byMcc;
  }

  return ruleHit(
    keywordsFor(country).bankCode,
    bankTransactionCode?.toLowerCase(),
    amountMinor
  );
};
