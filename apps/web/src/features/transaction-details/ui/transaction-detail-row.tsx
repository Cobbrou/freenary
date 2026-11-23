import {
  Item,
  ItemContent,
  ItemDescription,
} from "@freenary/ui/components/item";
import type { ReactNode } from "react";

const FLUSH_WITH_DRAWER_PADDING = "px-0";

export const TransactionDetailRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <Item className={FLUSH_WITH_DRAWER_PADDING} render={<li />} size="sm">
    <ItemContent>
      <ItemDescription>{label}</ItemDescription>
      {children}
    </ItemContent>
  </Item>
);
