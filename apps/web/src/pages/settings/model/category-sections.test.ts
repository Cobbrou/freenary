import { describe, expect, it } from "bun:test";

import { predefinedCategoryGroups } from "@freenary/api/lib/categories";
import type { CategoryEntry } from "@freenary/api/lib/categories";

import { editedOf, toCategorySections } from "./category-sections";
import type { CategorySection } from "./category-sections";

const custom = (
  id: string,
  label: string,
  parentKey: string | null
): CategoryEntry => ({
  color: "blue",
  icon: "HouseIcon",
  isAssignable: true,
  isCustom: true,
  isGroup: parentKey === null,
  key: `custom:${id}`,
  label,
  parentKey,
  usageCount: 0,
});

const listCategories = (customs: CategoryEntry[]): CategoryEntry[] => {
  const out: CategoryEntry[] = [];

  for (const { categories, group } of predefinedCategoryGroups()) {
    out.push(group, ...categories);

    for (const entry of customs) {
      if (entry.parentKey === group.key) {
        out.push(entry);
      }
    }
  }

  for (const entry of customs) {
    if (entry.parentKey !== null) {
      continue;
    }

    out.push(entry);

    for (const child of customs) {
      if (child.parentKey === entry.key) {
        out.push(child);
      }
    }
  }

  return out;
};

const keysOf = (sections: CategorySection[]) =>
  sections.flatMap((section) => section.items.map((item) => item.key));

describe("toCategorySections", () => {
  it("puts every predefined category under its own group heading", () => {
    const sections = toCategorySections(listCategories([]), "");

    expect(sections).toHaveLength(3);
    expect(keysOf(sections)).toHaveLength(27);

    for (const section of sections) {
      const { heading } = section;

      if (!heading) {
        throw new Error("every predefined section has a heading");
      }

      for (const item of section.items) {
        expect(item.parentKey).toBe(heading.key);
      }
    }
  });

  it("nests a custom category under its group", () => {
    const sections = toCategorySections(
      listCategories([custom("a", "Garage rent", "spending")]),
      ""
    );

    const spending = sections.find((s) => s.heading?.key === "spending");

    expect(spending?.items.at(-1)?.key).toBe("custom:a");
  });

  it("gives each top-level custom category its own unique section", () => {
    const sections = toCategorySections(
      listCategories([
        custom("a", "Hustle one", null),
        custom("b", "Hustle two", null),
      ]),
      ""
    );

    const headless = sections.filter((s) => s.heading === null);

    expect(headless).toHaveLength(2);
    expect(new Set(sections.map((s) => s.key)).size).toBe(sections.length);
  });

  it("keeps a custom section distinct from a group whose label it copies", () => {
    const sections = toCategorySections(
      listCategories([custom("a", "Spending", null)]),
      ""
    );

    expect(new Set(sections.map((s) => s.key)).size).toBe(sections.length);
  });

  it("drops headings left with nothing under them", () => {
    const sections = toCategorySections(listCategories([]), "rent");

    expect(sections.map((s) => s.heading?.label)).toEqual([
      "Income",
      "Spending",
    ]);

    expect(keysOf(sections)).toEqual(["rental-income", "rent-mortgage"]);
  });

  it("matches custom categories too, keeping their sections unique", () => {
    const sections = toCategorySections(
      listCategories([
        custom("a", "Zzz solo", null),
        custom("b", "Zzz nested", "spending"),
      ]),
      "zzz"
    );

    expect(keysOf(sections).toSorted()).toEqual(["custom:a", "custom:b"]);
    expect(new Set(sections.map((s) => s.key)).size).toBe(sections.length);
  });

  it("puts a subcategory in its own parent's section, right after it", () => {
    const sections = toCategorySections(
      listCategories([
        custom("a", "Side hustle", null),
        custom("a1", "Petrol", "custom:a"),
        custom("a2", "Tolls", "custom:a"),
      ]),
      ""
    );

    const hustle = sections.find((s) => s.key === "custom:a");

    expect(hustle?.items.map((item) => item.key)).toEqual([
      "custom:a",
      "custom:a1",
      "custom:a2",
    ]);
  });

  it("never files a matching subcategory under an unrelated heading", () => {
    const sections = toCategorySections(
      listCategories([
        custom("a", "Side hustle", null),
        custom("a1", "Zzz petrol", "custom:a"),
      ]),
      "zzz"
    );

    expect(keysOf(sections)).toEqual(["custom:a1"]);
    expect(sections.every((s) => s.heading === null)).toBe(true);
  });

  it("never drops or duplicates an entry", () => {
    const customs = [
      custom("a", "Garage", "spending"),
      custom("b", "Hustle", null),
      custom("c", "Gym", "investments"),
    ];

    const all = listCategories(customs);
    const rendered = keysOf(toCategorySections(all, ""));
    const assignable = all.flatMap((entry) =>
      entry.isAssignable ? [entry.key] : []
    );

    expect(rendered.toSorted()).toEqual(assignable.toSorted());
  });
});

describe("editedOf", () => {
  const nestedPinkUnderSpending: CategoryEntry = {
    ...custom("c1", "Pink Under Spending", "spending"),
    color: "blue",
    pickedColor: "pink",
  };

  it("seeds the drawer with the stored choice, not the painted group colour", () => {
    expect(editedOf(nestedPinkUnderSpending).color).toBe("pink");
  });

  it("does not overwrite the choice when only the name is edited", () => {
    const submitted = {
      ...editedOf(nestedPinkUnderSpending),
      label: "Renamed",
    };

    expect(submitted.color).toBe("pink");
    expect(submitted.parentKey).toBe("spending");
  });

  it("carries the choice through a promotion to top level", () => {
    const promoted = { ...editedOf(nestedPinkUnderSpending), parentKey: null };

    expect(promoted.color).toBe("pink");
  });

  it("falls back to the painted colour for an entry that carries no choice", () => {
    expect(editedOf(custom("c2", "No Pick", "income")).color).toBe("blue");
  });

  it("keeps a subcategory's custom parent key", () => {
    const subcategory = editedOf(custom("s1", "Petrol", "custom:abc"));

    expect(subcategory.parentKey).toBe("custom:abc");
    expect(subcategory.id).toBe("s1");
  });
});
