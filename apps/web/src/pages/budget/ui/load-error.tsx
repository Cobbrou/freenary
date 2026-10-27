import { Button } from "@freenary/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@freenary/ui/components/empty";
import { RiErrorWarningLine } from "@remixicon/react";

import { m } from "@/paraglide/messages.js";

export const LoadError = ({
  isRetrying,
  onRetry,
  title,
}: {
  isRetrying: boolean;
  onRetry: () => void;
  title: string;
}) => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <RiErrorWarningLine />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
    </EmptyHeader>
    <EmptyContent>
      <Button loading={isRetrying} onClick={onRetry} variant="tertiary">
        {m.budget_load_retry()}
      </Button>
    </EmptyContent>
  </Empty>
);
