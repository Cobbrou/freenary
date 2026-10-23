export const CATEGORY_COLOR_VALUES = [
  "blue",
  "green",
  "grey",
  "orange",
  "pink",
  "purple",
  "red",
] as const;

export type CategoryColor = (typeof CATEGORY_COLOR_VALUES)[number];

export const CATEGORY_PALETTE_SLOTS = [
  "blue",
  "blue-alt",
  "orange",
  "orange-alt",
  "teal",
  "teal-alt",
  "pink",
  "pink-alt",
  "purple",
  "purple-alt",
  "yellow",
  "yellow-alt",
  "green",
  "green-alt",
  "brown",
  "brown-alt",
  "grey",
] as const;

export type CategoryPaletteSlot = (typeof CATEGORY_PALETTE_SLOTS)[number];

export const CATEGORY_ICON_NAMES = [
  "AirplaneIcon",
  "ArrowsLeftRightIcon",
  "BankIcon",
  "BitcoinIcon",
  "BriefcaseIcon",
  "CarIcon",
  "CashIcon",
  "ChartPieIcon",
  "CoinsIcon",
  "DotsThreeIcon",
  "FilmSlateIcon",
  "FirstAidIcon",
  "ForkKnifeIcon",
  "GraduationCapIcon",
  "HouseIcon",
  "KeyIcon",
  "LightningIcon",
  "PiggyBankIcon",
  "PlantIcon",
  "ReceiptIcon",
  "RefundIcon",
  "RepeatIcon",
  "ShieldCheckIcon",
  "ShoppingBagIcon",
  "ShoppingCartIcon",
  "StorefrontIcon",
  "TrendUpIcon",
  "UsersIcon",
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_NAMES)[number];

export const CATEGORY_DIRECTIONS = ["in", "out", "both"] as const;

export type CategoryDirection = (typeof CATEGORY_DIRECTIONS)[number];

export const TRANSACTION_DIRECTIONS = ["outgoing", "incoming"] as const;

export type TransactionDirection = (typeof TRANSACTION_DIRECTIONS)[number];

export const CATEGORY_GROUPS = ["income", "investments", "spending"] as const;

export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

const CATEGORIES_BY_GROUP = {
  income: [
    "salary",
    "self-employment",
    "investment-income",
    "rental-income",
    "benefits",
    "refunds",
    "other-income",
  ],
  investments: ["savings", "securities", "retirement", "crypto"],
  spending: [
    "groceries",
    "restaurants",
    "rent-mortgage",
    "bills-utilities",
    "car-fuel",
    "transport-travel",
    "shopping",
    "entertainment",
    "subscriptions",
    "health",
    "family-education",
    "taxes",
    "loans-bank-fees",
    "people",
    "cash-withdrawal",
    "uncategorised",
  ],
} as const satisfies Record<CategoryGroup, readonly string[]>;

export const SPENDING_CATEGORIES = [
  ...CATEGORIES_BY_GROUP.income,
  ...CATEGORIES_BY_GROUP.investments,
  ...CATEGORIES_BY_GROUP.spending,
] as const;

export type SpendingCategory = (typeof SPENDING_CATEGORIES)[number];

export const TAXONOMY_VERSION = 2;

export const CATEGORY_GROUP_LABELS = {
  income: "Income",
  investments: "Savings & investment",
  spending: "Spending",
} as const satisfies Record<CategoryGroup, string>;

export const CATEGORY_GROUP_COLORS = {
  income: "green",
  investments: "purple",
  spending: "blue",
} as const satisfies Record<CategoryGroup, CategoryColor>;

export const CATEGORY_GROUP_ICONS = {
  income: "BankIcon",
  investments: "PiggyBankIcon",
  spending: "CoinsIcon",
} as const satisfies Record<CategoryGroup, CategoryIconName>;

export const CATEGORY_GROUP_OF = {
  benefits: "income",
  "bills-utilities": "spending",
  "car-fuel": "spending",
  "cash-withdrawal": "spending",
  crypto: "investments",
  entertainment: "spending",
  "family-education": "spending",
  groceries: "spending",
  health: "spending",
  "investment-income": "income",
  "loans-bank-fees": "spending",
  "other-income": "income",
  people: "spending",
  refunds: "income",
  "rent-mortgage": "spending",
  "rental-income": "income",
  restaurants: "spending",
  retirement: "investments",
  salary: "income",
  savings: "investments",
  securities: "investments",
  "self-employment": "income",
  shopping: "spending",
  subscriptions: "spending",
  taxes: "spending",
  "transport-travel": "spending",
  uncategorised: "spending",
} as const satisfies Record<SpendingCategory, CategoryGroup>;

export const CATEGORY_LABELS = {
  benefits: "Benefits & pension",
  "bills-utilities": "Bills & utilities",
  "car-fuel": "Car & fuel",
  "cash-withdrawal": "Cash withdrawal",
  crypto: "Crypto",
  entertainment: "Entertainment & leisure",
  "family-education": "Family & education",
  groceries: "Groceries",
  health: "Health & medical",
  "investment-income": "Investment income",
  "loans-bank-fees": "Loans & bank fees",
  "other-income": "Other income",
  people: "People",
  refunds: "Refunds & reimbursements",
  "rent-mortgage": "Rent & mortgage",
  "rental-income": "Rental income",
  restaurants: "Restaurants & going out",
  retirement: "Retirement & long-term savings",
  salary: "Salary & wages",
  savings: "Savings",
  securities: "Investments",
  "self-employment": "Self-employment & business income",
  shopping: "Shopping",
  subscriptions: "Subscriptions",
  taxes: "Taxes",
  "transport-travel": "Transport & travel",
  uncategorised: "Uncategorised",
} as const satisfies Record<SpendingCategory, string>;

export const CATEGORY_DIRECTION_OF = {
  benefits: "in",
  "bills-utilities": "out",
  "car-fuel": "out",
  "cash-withdrawal": "both",
  crypto: "out",
  entertainment: "out",
  "family-education": "out",
  groceries: "out",
  health: "out",
  "investment-income": "in",
  "loans-bank-fees": "out",
  "other-income": "in",
  people: "both",
  refunds: "in",
  "rent-mortgage": "out",
  "rental-income": "in",
  restaurants: "out",
  retirement: "out",
  salary: "in",
  savings: "out",
  securities: "out",
  "self-employment": "in",
  shopping: "out",
  subscriptions: "out",
  taxes: "out",
  "transport-travel": "out",
  uncategorised: "both",
} as const satisfies Record<SpendingCategory, CategoryDirection>;

export const CATEGORY_ICONS = {
  benefits: "ShieldCheckIcon",
  "bills-utilities": "LightningIcon",
  "car-fuel": "CarIcon",
  "cash-withdrawal": "CashIcon",
  crypto: "BitcoinIcon",
  entertainment: "FilmSlateIcon",
  "family-education": "GraduationCapIcon",
  groceries: "ShoppingCartIcon",
  health: "FirstAidIcon",
  "investment-income": "TrendUpIcon",
  "loans-bank-fees": "CoinsIcon",
  "other-income": "BankIcon",
  people: "UsersIcon",
  refunds: "RefundIcon",
  "rent-mortgage": "HouseIcon",
  "rental-income": "KeyIcon",
  restaurants: "ForkKnifeIcon",
  retirement: "PlantIcon",
  salary: "BriefcaseIcon",
  savings: "PiggyBankIcon",
  securities: "ChartPieIcon",
  "self-employment": "StorefrontIcon",
  shopping: "ShoppingBagIcon",
  subscriptions: "RepeatIcon",
  taxes: "ReceiptIcon",
  "transport-travel": "AirplaneIcon",
  uncategorised: "DotsThreeIcon",
} as const satisfies Record<SpendingCategory, CategoryIconName>;

export const CATEGORY_PALETTE_SLOT_OF = {
  benefits: "purple",
  "bills-utilities": "pink",
  "car-fuel": "green",
  "cash-withdrawal": "green-alt",
  crypto: "pink",
  entertainment: "blue-alt",
  "family-education": "teal-alt",
  groceries: "orange",
  health: "brown",
  "investment-income": "teal",
  "loans-bank-fees": "purple-alt",
  "other-income": "green",
  people: "yellow-alt",
  refunds: "yellow",
  "rent-mortgage": "blue",
  "rental-income": "pink",
  restaurants: "teal",
  retirement: "teal",
  salary: "blue",
  savings: "blue",
  securities: "orange",
  "self-employment": "orange",
  shopping: "yellow",
  subscriptions: "orange-alt",
  taxes: "pink-alt",
  "transport-travel": "purple",
  uncategorised: "grey",
} as const satisfies Record<SpendingCategory, CategoryPaletteSlot>;

export const CATEGORY_GROUP_FALLBACKS = {
  income: "other-income",
  investments: "savings",
  spending: "uncategorised",
} as const satisfies Record<CategoryGroup, SpendingCategory>;

export const LEGACY_CATEGORY_SLUGS = {
  accommodation: "transport-travel",
  "bank-fees": "loans-bank-fees",
  "bars-cafes": "restaurants",
  "child-support": "people",
  childcare: "family-education",
  clothing: "shopping",
  courses: "family-education",
  culture: "entertainment",
  dining: "restaurants",
  donations: "uncategorised",
  education: "family-education",
  electronics: "shopping",
  energy: "bills-utilities",
  flights: "transport-travel",
  fuel: "car-fuel",
  furniture: "shopping",
  gifts: "shopping",
  "health-insurance": "bills-utilities",
  hobbies: "entertainment",
  "home-charges": "bills-utilities",
  "home-insurance": "bills-utilities",
  "home-maintenance": "bills-utilities",
  "household-supplies": "groceries",
  housing: "rent-mortgage",
  income: "other-income",
  "income-tax": "taxes",
  insurance: "bills-utilities",
  "internal-transfer": "uncategorised",
  "life-insurance": "retirement",
  "loan-repayment": "loans-bank-fees",
  medical: "health",
  memberships: "subscriptions",
  mortgage: "rent-mortgage",
  other: "uncategorised",
  "other-daily-living": "uncategorised",
  "other-education": "family-education",
  "other-financial": "loans-bank-fees",
  "other-health": "health",
  "other-housing": "rent-mortgage",
  "other-insurance": "bills-utilities",
  "other-investment": "savings",
  "other-leisure": "entertainment",
  "other-shopping": "shopping",
  "other-subscription": "subscriptions",
  "other-taxes": "taxes",
  "other-transfer": "uncategorised",
  "other-transport": "transport-travel",
  "other-travel": "transport-travel",
  "other-utilities": "bills-utilities",
  "parking-tolls": "car-fuel",
  "personal-care": "health",
  pets: "shopping",
  pharmacy: "health",
  "property-tax": "taxes",
  "public-transport": "transport-travel",
  rent: "rent-mortgage",
  software: "subscriptions",
  sports: "entertainment",
  streaming: "subscriptions",
  takeaway: "restaurants",
  taxi: "transport-travel",
  telecom: "bills-utilities",
  transfers: "uncategorised",
  transport: "transport-travel",
  travel: "transport-travel",
  tuition: "family-education",
  utilities: "bills-utilities",
  "vehicle-insurance": "car-fuel",
  "vehicle-maintenance": "car-fuel",
  water: "bills-utilities",
} as const satisfies Record<string, SpendingCategory>;

export const LEGACY_CATEGORY_GROUPS = {
  "daily-living": "spending",
  education: "spending",
  financial: "spending",
  health: "spending",
  housing: "spending",
  leisure: "spending",
  other: "spending",
  shopping: "spending",
  subscriptions: "spending",
  taxes: "spending",
  transfers: "spending",
  transport: "spending",
  travel: "spending",
  utilities: "spending",
} as const satisfies Record<string, CategoryGroup>;

export const isSpendingCategory = (value: string): value is SpendingCategory =>
  Object.hasOwn(CATEGORY_LABELS, value);

export const isCategoryGroup = (value: string): value is CategoryGroup =>
  Object.hasOwn(CATEGORY_GROUP_LABELS, value);

export const isCategoryColor = (value: string): value is CategoryColor =>
  CATEGORY_COLOR_VALUES.some((color) => color === value);

export const categoriesInGroup = (
  group: CategoryGroup
): readonly SpendingCategory[] => CATEGORIES_BY_GROUP[group];

export const categoryColor = (category: SpendingCategory): CategoryColor =>
  CATEGORY_GROUP_COLORS[CATEGORY_GROUP_OF[category]];

export const categoryPaletteSlot = (
  category: SpendingCategory
): CategoryPaletteSlot => CATEGORY_PALETTE_SLOT_OF[category];

export const categoryIcon = (category: SpendingCategory): CategoryIconName =>
  CATEGORY_ICONS[category];

export const categoryDirection = (
  category: SpendingCategory
): CategoryDirection => CATEGORY_DIRECTION_OF[category];

const offeredOn = (
  direction: TransactionDirection
): readonly SpendingCategory[] => {
  const wanted = direction === "incoming" ? "in" : "out";

  return SPENDING_CATEGORIES.filter((category) => {
    const allowed = CATEGORY_DIRECTION_OF[category];

    return allowed === wanted || allowed === "both";
  });
};

const CATEGORIES_BY_TRANSACTION_DIRECTION = {
  incoming: offeredOn("incoming"),
  outgoing: offeredOn("outgoing"),
} as const satisfies Record<TransactionDirection, readonly SpendingCategory[]>;

export const categoriesForDirection = (
  direction: TransactionDirection
): readonly SpendingCategory[] =>
  CATEGORIES_BY_TRANSACTION_DIRECTION[direction];

export const resolveCategorySlug = (value: string): SpendingCategory | null => {
  if (isSpendingCategory(value)) {
    return value;
  }

  // SAFETY: the hasOwn guard proves `value` keys LEGACY_CATEGORY_SLUGS
  return Object.hasOwn(LEGACY_CATEGORY_SLUGS, value)
    ? LEGACY_CATEGORY_SLUGS[value as keyof typeof LEGACY_CATEGORY_SLUGS]
    : null;
};

export const resolveCategoryGroup = (value: string): CategoryGroup | null => {
  if (isCategoryGroup(value)) {
    return value;
  }

  // SAFETY: the hasOwn guard proves `value` keys LEGACY_CATEGORY_GROUPS
  return Object.hasOwn(LEGACY_CATEGORY_GROUPS, value)
    ? LEGACY_CATEGORY_GROUPS[value as keyof typeof LEGACY_CATEGORY_GROUPS]
    : null;
};
