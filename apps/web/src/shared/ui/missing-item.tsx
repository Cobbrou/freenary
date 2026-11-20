import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@freenary/ui/components/empty";
import type { ReactNode } from "react";

interface MissingItemProps {
  action: ReactNode;
  description: string;
  title: string;
}

export const MissingItem = ({
  action,
  description,
  title,
}: MissingItemProps) => (
  <Empty className="flex-1">
    <EmptyHeader>
      <EmptyTitle>
        <h1>{title}</h1>
      </EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
    <EmptyContent>{action}</EmptyContent>
  </Empty>
);
