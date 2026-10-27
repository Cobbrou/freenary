import { Avatar, AvatarFallback } from "@freenary/ui/components/avatar";
import { Skeleton } from "@freenary/ui/components/skeleton";

import { m } from "@/paraglide/messages.js";
import { userInitials } from "@/shared/lib/user-initials";

interface UserIdentityProps {
  email: string | undefined;
  hasUpdate?: boolean;
  isPending?: boolean;
  name: string | undefined;
}

export const UserIdentity = ({
  email,
  hasUpdate,
  isPending,
  name,
}: UserIdentityProps) => {
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
      <span className="relative shrink-0">
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">
            {userInitials(name)}
          </AvatarFallback>
        </Avatar>
        {hasUpdate && (
          <span className="bg-primary ring-sidebar absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2">
            <span className="sr-only">{m.account_menu_update_notice()}</span>
          </span>
        )}
      </span>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{name}</span>
        <span className="text-muted-foreground truncate text-xs">{email}</span>
      </div>
    </>
  );
};
