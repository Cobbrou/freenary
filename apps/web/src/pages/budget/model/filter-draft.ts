import {
  AMOUNT_FILTER_OPERATORS,
  takesSeveralValues,
} from "@freenary/api/lib/transaction-filters";
import type {
  AmountFilterOperator,
  CategoryFilterValue,
  ListFilterOperator,
  TransactionFilter,
  TransactionFilterField,
} from "@freenary/api/lib/transaction-filters";

export interface OperatorDraft {
  field: TransactionFilterField;
  stage: "operator";
}

export interface AmountDraft {
  field: "amount";
  operator: AmountFilterOperator;
  stage: "amount";
}

export interface CategoryDraft {
  field: "category";
  operator: ListFilterOperator;
  stage: "values";
  values: CategoryFilterValue[];
}

export interface CompanyDraft {
  field: "company";
  operator: ListFilterOperator;
  stage: "values";
  values: string[];
}

export type ValuesDraft = CategoryDraft | CompanyDraft;

export type FilterDraft = AmountDraft | OperatorDraft | ValuesDraft;

const isAmountOperator = (
  operator: AmountFilterOperator | ListFilterOperator
): operator is AmountFilterOperator =>
  AMOUNT_FILTER_OPERATORS.some((amountOperator) => amountOperator === operator);

export const draftForField = (
  field: TransactionFilterField
): OperatorDraft => ({
  field,
  stage: "operator",
});

export const withOperator = (
  { field }: OperatorDraft,
  operator: AmountFilterOperator | ListFilterOperator
): FilterDraft => {
  if (isAmountOperator(operator)) {
    return { field: "amount", operator, stage: "amount" };
  }

  if (field === "category") {
    return { field, operator, stage: "values", values: [] };
  }

  return { field: "company", operator, stage: "values", values: [] };
};

const toggled = <Value extends string>(
  values: readonly Value[],
  value: Value
): Value[] =>
  values.includes(value)
    ? values.filter((kept) => kept !== value)
    : [...values, value];

const withPicked = <
  Value extends string,
  Draft extends { operator: ListFilterOperator; values: Value[] },
>(
  draft: Draft,
  value: Value
): Draft => ({
  ...draft,
  values: takesSeveralValues(draft.operator)
    ? toggled(draft.values, value)
    : [value],
});

export const withCategory = (
  draft: CategoryDraft,
  value: CategoryFilterValue
): CategoryDraft => withPicked(draft, value);

export const withCompany = (draft: CompanyDraft, name: string): CompanyDraft =>
  withPicked(draft, name);

export const isReadyToApply = (draft: ValuesDraft) =>
  !takesSeveralValues(draft.operator) && draft.values.length === 1;

export const appliedValues = (draft: ValuesDraft): TransactionFilter | null => {
  if (draft.values.length === 0) {
    return null;
  }

  return draft.field === "category"
    ? { field: "category", operator: draft.operator, values: draft.values }
    : { field: "company", operator: draft.operator, values: draft.values };
};

export const appliedAmount = (
  draft: AmountDraft,
  minorUnits: number
): TransactionFilter => ({
  field: "amount",
  operator: draft.operator,
  value: minorUnits,
});

const withoutLastValue = (draft: ValuesDraft): ValuesDraft =>
  draft.field === "category"
    ? { ...draft, values: draft.values.slice(0, -1) }
    : { ...draft, values: draft.values.slice(0, -1) };

export const stepBack = (draft: FilterDraft): FilterDraft | null => {
  if (draft.stage === "operator") {
    return null;
  }

  if (draft.stage === "values" && draft.values.length > 0) {
    return withoutLastValue(draft);
  }

  return draftForField(draft.field);
};
