import { Button } from "@freenary/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@freenary/ui/components/empty";
import { RiWalletLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";

interface NoBankAccountProps {
  actionLabel: string;
  description: string;
  title: string;
}

export const NoBankAccount = ({
  actionLabel,
  description,
  title,
}: NoBankAccountProps) => (
  <div className="flex flex-1 flex-col items-center justify-center p-4">
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RiWalletLine />
        </EmptyMedia>
        <EmptyTitle>
          <h1>{title}</h1>
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <Button asChild>
        <Link search={{ section: "bank-accounts" }} to="/settings">
          {actionLabel}
        </Link>
      </Button>
    </Empty>
  </div>
);
