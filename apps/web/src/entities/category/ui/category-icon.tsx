import type { CategoryAppearance } from "@freenary/api/lib/categories";
import type {
  CategoryColor,
  CategoryIconName,
} from "@freenary/api/lib/taxonomy";
import { cn } from "@freenary/ui/lib/utils";
import {
  RiArrowLeftRightFill,
  RiBankFill,
  RiBitCoinFill,
  RiBriefcaseFill,
  RiCarFill,
  RiCashFill,
  RiClapperboardFill,
  RiCoinsFill,
  RiFirstAidKitFill,
  RiFlashlightFill,
  RiGraduationCapFill,
  RiGroupFill,
  RiHomeFill,
  RiKey2Fill,
  RiLineChartFill,
  RiMoreFill,
  RiPieChartFill,
  RiPlaneFill,
  RiPlantFill,
  RiReceiptFill,
  RiRefund2Fill,
  RiRepeatFill,
  RiRestaurantFill,
  RiSafeFill,
  RiShieldCheckFill,
  RiShoppingBagFill,
  RiShoppingCartFill,
  RiStoreFill,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";

const FILL_ICON_BY_NAME = {
  AirplaneIcon: RiPlaneFill,
  ArrowsLeftRightIcon: RiArrowLeftRightFill,
  BankIcon: RiBankFill,
  BitcoinIcon: RiBitCoinFill,
  BriefcaseIcon: RiBriefcaseFill,
  CarIcon: RiCarFill,
  CashIcon: RiCashFill,
  ChartPieIcon: RiPieChartFill,
  CoinsIcon: RiCoinsFill,
  DotsThreeIcon: RiMoreFill,
  FilmSlateIcon: RiClapperboardFill,
  FirstAidIcon: RiFirstAidKitFill,
  ForkKnifeIcon: RiRestaurantFill,
  GraduationCapIcon: RiGraduationCapFill,
  HouseIcon: RiHomeFill,
  KeyIcon: RiKey2Fill,
  LightningIcon: RiFlashlightFill,
  PiggyBankIcon: RiSafeFill,
  PlantIcon: RiPlantFill,
  ReceiptIcon: RiReceiptFill,
  RefundIcon: RiRefund2Fill,
  RepeatIcon: RiRepeatFill,
  ShieldCheckIcon: RiShieldCheckFill,
  ShoppingBagIcon: RiShoppingBagFill,
  ShoppingCartIcon: RiShoppingCartFill,
  StorefrontIcon: RiStoreFill,
  TrendUpIcon: RiLineChartFill,
  UsersIcon: RiGroupFill,
} satisfies Record<CategoryIconName, RemixiconComponentType>;

export const SWATCH_BY_COLOR = {
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  green: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400",
  grey: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
  orange:
    "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  pink: "bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400",
  purple:
    "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
  red: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
} satisfies Record<CategoryColor, string>;

export const CategoryIcon = ({
  className,
  color,
  icon,
}: CategoryAppearance & { className?: string }) => {
  const IconComponent =
    FILL_ICON_BY_NAME[icon] ?? FILL_ICON_BY_NAME.DotsThreeIcon;

  const bg = SWATCH_BY_COLOR[color] ?? SWATCH_BY_COLOR.grey;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        bg,
        className
      )}
    >
      <IconComponent />
    </div>
  );
};
