import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@freenary/ui/components/empty";
import { RiErrorWarningLine, RiPlugLine } from "@remixicon/react";
import type { ReactNode } from "react";

import { m } from "@/paraglide/messages.js";

export const BankLinkingCheckFailed = () => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <RiErrorWarningLine />
      </EmptyMedia>
      <EmptyTitle>{m.bank_linking_check_error_title()}</EmptyTitle>
      <EmptyDescription>
        {m.bank_linking_check_error_description()}
      </EmptyDescription>
    </EmptyHeader>
  </Empty>
);

export const BankLinkingUnavailable = ({
  children,
}: {
  children?: ReactNode;
}) => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <RiPlugLine />
      </EmptyMedia>
      <EmptyTitle>{m.bank_linking_unavailable_title()}</EmptyTitle>
      <EmptyDescription>
        {m.bank_linking_unavailable_description()}
      </EmptyDescription>
    </EmptyHeader>
    {children === undefined ? null : <EmptyContent>{children}</EmptyContent>}
  </Empty>
);
