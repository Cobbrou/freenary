import { describe, expect, it } from "bun:test";

import {
  appliedAmount,
  appliedValues,
  draftForField,
  isReadyToApply,
  stepBack,
  withCategory,
  withCompany,
  withOperator,
} from "./filter-draft";
import type { CompanyDraft } from "./filter-draft";

const companyDraft = (operator: CompanyDraft["operator"]): CompanyDraft => ({
  field: "company",
  operator,
  stage: "values",
  values: [],
});

describe("withOperator", () => {
  it("asks for an amount after an amount comparison", () => {
    expect(withOperator(draftForField("amount"), "gt")).toEqual({
      field: "amount",
      operator: "gt",
      stage: "amount",
    });
  });

  it("asks for values after a list operator", () => {
    expect(withOperator(draftForField("category"), "isNot")).toEqual({
      field: "category",
      operator: "isNot",
      stage: "values",
      values: [],
    });
  });
});

describe("picking values", () => {
  it("applies a single-value operator on the first pick", () => {
    const picked = withCompany(companyDraft("isNot"), "Amazon");

    expect(isReadyToApply(picked)).toBe(true);
    expect(appliedValues(picked)).toEqual({
      field: "company",
      operator: "isNot",
      values: ["Amazon"],
    });
  });

  it("toggles values for is any of and waits to be applied", () => {
    const twice = withCompany(withCompany(companyDraft("isAnyOf"), "A"), "B");
    const toggledOff = withCompany(twice, "A");

    expect(twice.values).toEqual(["A", "B"]);
    expect(isReadyToApply(twice)).toBe(false);
    expect(toggledOff.values).toEqual(["B"]);
  });

  it("applies nothing while no value is picked", () => {
    expect(appliedValues(companyDraft("isAnyOf"))).toBeNull();
  });

  it("keeps a category value typed", () => {
    const draft = withCategory(
      { field: "category", operator: "is", stage: "values", values: [] },
      "spending"
    );

    expect(appliedValues(draft)).toEqual({
      field: "category",
      operator: "is",
      values: ["spending"],
    });
  });

  it("turns an amount into a filter in minor units", () => {
    expect(
      appliedAmount({ field: "amount", operator: "lt", stage: "amount" }, 5000)
    ).toEqual({ field: "amount", operator: "lt", value: 5000 });
  });
});

describe("stepBack", () => {
  it("drops the last picked value first", () => {
    const draft = withCompany(withCompany(companyDraft("isAnyOf"), "A"), "B");

    expect(stepBack(draft)).toEqual({ ...draft, values: ["A"] });
  });

  it("returns to the operator, then cancels", () => {
    const operatorStage = stepBack(companyDraft("is"));

    expect(operatorStage).toEqual({ field: "company", stage: "operator" });

    if (operatorStage === null) {
      throw new Error("expected the operator stage");
    }

    expect(stepBack(operatorStage)).toBeNull();
  });
});
