import { SPENDING_CATEGORIES } from "@freenary/api/lib/taxonomy";
import type { SpendingCategory } from "@freenary/api/lib/taxonomy";

export interface CategoryAmount {
  amount: number;
  category: SpendingCategory;
}

export type BreakdownSlice =
  | { amount: number; category: SpendingCategory; kind: "category" }
  | { amount: number; categories: CategoryAmount[]; kind: "other" };

const MOST_SLICES_WITHOUT_OTHER = 7;
const CATEGORIES_BESIDE_OTHER = 6;

const taxonomyPlace = (category: SpendingCategory): number =>
  SPENDING_CATEGORIES.indexOf(category);

const byAmountThenTaxonomy = (a: CategoryAmount, b: CategoryAmount): number =>
  b.amount - a.amount || taxonomyPlace(a.category) - taxonomyPlace(b.category);

const categorySlice = ({
  amount,
  category,
}: CategoryAmount): BreakdownSlice => ({
  amount,
  category,
  kind: "category",
});

export const breakdownSlices = (
  categories: readonly CategoryAmount[]
): BreakdownSlice[] => {
  const ranked = categories.toSorted(byAmountThenTaxonomy);

  if (ranked.length <= MOST_SLICES_WITHOUT_OTHER) {
    return ranked.map(categorySlice);
  }

  const shown = ranked.slice(0, CATEGORIES_BESIDE_OTHER);
  const grouped = ranked.slice(CATEGORIES_BESIDE_OTHER);

  return [
    ...shown.map(categorySlice),
    {
      amount: grouped.reduce((sum, entry) => sum + entry.amount, 0),
      categories: grouped,
      kind: "other",
    },
  ];
};

export const sliceCategories = (slice: BreakdownSlice): SpendingCategory[] =>
  slice.kind === "other"
    ? slice.categories.map((entry) => entry.category)
    : [slice.category];

export const isSliceSelected = (
  slice: BreakdownSlice,
  activeCategories: readonly SpendingCategory[]
): boolean =>
  sliceCategories(slice).some((category) =>
    activeCategories.includes(category)
  );
