import { describe, expect, it } from "bun:test";

import {
  customCategoryColor,
  customCategoryDisplayColor,
  customCategoryPickedColor,
} from "./categories";
import {
  CATEGORY_COLOR_VALUES,
  CATEGORY_GROUP_COLORS,
  CATEGORY_GROUPS,
} from "./taxonomy";

const otherGroupColours = (group: (typeof CATEGORY_GROUPS)[number]) =>
  CATEGORY_GROUPS.flatMap((other) =>
    other === group ? [] : [CATEGORY_GROUP_COLORS[other]]
  );

describe("customCategoryColor", () => {
  it("gives a nested custom category its parent group's colour", () => {
    for (const group of CATEGORY_GROUPS) {
      for (const chosen of CATEGORY_COLOR_VALUES) {
        expect(customCategoryColor(group, chosen)).toBe(
          CATEGORY_GROUP_COLORS[group]
        );
      }
    }
  });

  it("never lets a nested custom category wear another group's colour", () => {
    for (const group of CATEGORY_GROUPS) {
      const shown = customCategoryColor(group, "green");

      expect(otherGroupColours(group)).not.toContain(shown);
    }
  });

  it("keeps the chosen colour for a top-level custom group", () => {
    for (const chosen of CATEGORY_COLOR_VALUES) {
      expect(customCategoryColor(null, chosen)).toBe(chosen);
    }
  });

  it("shows the stored choice when the parent slug is not a known group", () => {
    expect(customCategoryColor("not-a-group", "pink")).toBe("pink");
    expect(customCategoryColor("not-a-group", "chartreuse")).toBe("grey");
  });

  it("falls back to grey when the stored colour is not in the palette", () => {
    expect(customCategoryColor(null, "chartreuse")).toBe("grey");
    expect(customCategoryColor(null, "")).toBe("grey");
  });
});

describe("customCategoryPickedColor", () => {
  it("reports the stored choice whatever the category is nested under", () => {
    expect(customCategoryPickedColor("pink")).toBe("pink");
    expect(customCategoryColor("spending", "pink")).toBe(
      CATEGORY_GROUP_COLORS.spending
    );
  });

  it("falls back to grey when the stored colour is not in the palette", () => {
    expect(customCategoryPickedColor("chartreuse")).toBe("grey");
  });
});

describe("customCategoryDisplayColor", () => {
  it("paints a subcategory its parent's picked colour", () => {
    expect(
      customCategoryDisplayColor({
        chosen: "pink",
        parentChosenColor: "purple",
        parentSlug: null,
      })
    ).toBe("purple");
  });

  it("falls back to grey when the parent's stored colour is unreadable", () => {
    expect(
      customCategoryDisplayColor({
        chosen: "pink",
        parentChosenColor: "chartreuse",
        parentSlug: null,
      })
    ).toBe("grey");
  });

  it("keeps the group rule for a category with no custom parent", () => {
    expect(
      customCategoryDisplayColor({
        chosen: "pink",
        parentChosenColor: null,
        parentSlug: "spending",
      })
    ).toBe(CATEGORY_GROUP_COLORS.spending);

    expect(
      customCategoryDisplayColor({
        chosen: "pink",
        parentChosenColor: null,
        parentSlug: null,
      })
    ).toBe("pink");
  });
});
