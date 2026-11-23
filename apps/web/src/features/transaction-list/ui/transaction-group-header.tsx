import { useTypeScale } from "@freenary/ui/lib/size-context";

import { formatCurrency } from "@/shared/lib/format-currency";

export const TransactionGroupHeader = ({
  label,
  total,
  currency,
  index,
  offset,
  measureRef,
}: {
  label: string;
  total: number;
  currency: string;
  index: number;
  offset: number;
  measureRef: (node: Element | null) => void;
}) => {
  const type = useTypeScale();

  return (
    <div
      data-index={index}
      ref={measureRef}
      className="text-muted-foreground absolute inset-x-0 flex items-center justify-between px-1 pt-4 pb-1.5 font-medium"
      style={{ fontSize: type.caption, top: offset }}
    >
      <span>{label}</span>
      <span className="tabular-nums">{formatCurrency(total, currency)}</span>
    </div>
  );
};
