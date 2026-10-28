import { categoryPaletteSlot } from "@freenary/api/lib/taxonomy";
import type { SpendingCategory } from "@freenary/api/lib/taxonomy";

export const categoryChartColor = (category: SpendingCategory): string =>
  `var(--category-${categoryPaletteSlot(category)})`;
