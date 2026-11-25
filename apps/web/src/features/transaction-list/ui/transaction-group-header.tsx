import { useTypeScale } from "@freenary/ui/lib/size-context";

import { formatCurrency } from "@/shared/lib/format-currency";

import type { GroupTotal } from "../model/transaction-groups";

const TOTALS_SEPARATOR = " · ";

export const TransactionGroupHeader = ({
  label,
  totals,
  index,
  offset,
  measureRef,
}: {
  label: string;
  totals: GroupTotal[];
  index: number;
  offset: number;
  measureRef: (node: Element | null) => void;
}) => {
  const type = useTypeScale();

  return (
    <div
      data-index={index}
      ref={measureRef}
      className="text-muted-foreground absolute inset-x-0 flex items-center justify-between gap-3 px-1 pt-4 pb-1.5 font-medium"
      style={{ fontSize: type.caption, top: offset }}
    >
      <span>{label}</span>
      <span className="text-end tabular-nums">
        {totals
          .map(({ currency, total }) => formatCurrency(total, currency))
          .join(TOTALS_SEPARATOR)}
      </span>
    </div>
  );
};
