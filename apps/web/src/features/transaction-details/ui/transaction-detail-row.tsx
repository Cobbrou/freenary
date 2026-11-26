import { Item, ItemContent, ItemTitle } from "@freenary/ui/components/item";
import type { ReactNode } from "react";

const FLUSH_WITH_DRAWER_PADDING = "px-0";

export const TransactionDetailRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <Item
    className={`${FLUSH_WITH_DRAWER_PADDING} flex-nowrap items-start`}
    render={<li />}
    size="sm"
  >
    <ItemContent className="flex-none">
      <ItemTitle className="whitespace-nowrap">{label}</ItemTitle>
    </ItemContent>
    <div className="flex min-w-0 flex-1 flex-col items-end gap-1 text-end break-words">
      {children}
    </div>
  </Item>
);
