import { RiErrorWarningLine } from "@remixicon/react";

import { m } from "@/paraglide/messages.js";
import { remixIcon } from "@/shared/lib/remix-icon";

const NOTICE_ICON_SIZE = 16;
const AlertIcon = remixIcon(RiErrorWarningLine);

interface FaultNoticeProps {
  detail: string;
}

export const FaultNotice = ({ detail }: FaultNoticeProps) => (
  <div
    className="border-destructive/40 text-destructive flex items-start gap-2 rounded-xl border p-3 text-sm"
    role="alert"
  >
    <AlertIcon
      aria-hidden="true"
      className="mt-0.5 shrink-0"
      size={NOTICE_ICON_SIZE}
    />
    <div className="flex min-w-0 flex-col gap-1">
      <p className="font-medium">{m.setup_fault_badge()}</p>
      <p className="text-muted-foreground break-words">
        {m.setup_fault_title({ detail })}
      </p>
    </div>
  </div>
);
