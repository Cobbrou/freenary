import { categoryPaletteSlot } from "@freenary/api/lib/taxonomy";
import type {
  CategoryColor,
  SpendingCategory,
} from "@freenary/api/lib/taxonomy";

export const CHART_COLOR_VARS = {
  blue: "var(--chart-blue)",
  green: "var(--chart-green)",
  grey: "var(--chart-grey)",
  orange: "var(--chart-orange)",
  pink: "var(--chart-pink)",
  purple: "var(--chart-purple)",
  red: "var(--chart-red)",
} satisfies Record<CategoryColor, string>;

export const categoryChartColor = (category: SpendingCategory): string =>
  `var(--category-${categoryPaletteSlot(category)})`;
