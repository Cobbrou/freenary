import { Avatar, AvatarFallback } from "@freenary/ui/components/avatar";
import { Skeleton } from "@freenary/ui/components/skeleton";

import { userInitials } from "@/shared/lib/user-initials";

interface UserIdentityProps {
  email: string | undefined;
  isPending?: boolean;
  name: string | undefined;
}

export const UserIdentity = ({ email, isPending, name }: UserIdentityProps) => {
  if (isPending) {
    return (
      <>
        <Skeleton className="size-8 rounded-full" />
        <div className="grid flex-1 gap-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </>
    );
  }

  return (
    <>
      <Avatar className="size-8">
        <AvatarFallback className="text-xs">
          {userInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{name}</span>
        <span className="text-muted-foreground truncate text-xs">{email}</span>
      </div>
    </>
  );
};
