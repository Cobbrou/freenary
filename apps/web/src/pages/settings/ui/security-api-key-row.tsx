import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@freenary/ui/components/alert-dialog";
import { Button } from "@freenary/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@freenary/ui/components/item";
import { useRegisterFluidHoverItem } from "@freenary/ui/hooks/use-fluid-hover";
import { useRef } from "react";

import { m } from "@/paraglide/messages.js";

import type { ApiKeySummary } from "../api/auth-queries";

interface SecurityApiKeyRowProps {
  apiKey: ApiKeySummary;
  formatter: Intl.DateTimeFormat;
  index: number;
  isRevoking: boolean;
  onRevoke: (keyId: string) => void;
  registerItem: (index: number, element: HTMLElement | null) => void;
}

export const SecurityApiKeyRow = ({
  apiKey,
  formatter,
  index,
  isRevoking,
  onRevoke,
  registerItem,
}: SecurityApiKeyRowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const storedName = apiKey.name?.trim() ?? "";
  const displayName =
    storedName === "" ? m.settings_api_keys_unnamed() : storedName;

  const expiry =
    apiKey.expiresAt === null
      ? m.settings_api_keys_never_expires()
      : m.settings_api_keys_expires({
          date: formatter.format(apiKey.expiresAt),
        });

  const lastUsed =
    apiKey.lastRequest === null
      ? m.settings_api_keys_never_used()
      : m.settings_api_keys_last_used({
          date: formatter.format(apiKey.lastRequest),
        });

  const details = [
    m.settings_api_keys_created({ date: formatter.format(apiKey.createdAt) }),
    expiry,
    lastUsed,
  ].join(" · ");

  useRegisterFluidHoverItem(registerItem, index, rowRef);

  return (
    <Item className="relative z-10" ref={rowRef} render={<li />} size="sm">
      <ItemContent className="min-w-0">
        <ItemTitle className="flex flex-wrap items-center gap-2">
          {displayName}
          {apiKey.start === null ? null : (
            <code className="text-muted-foreground font-mono font-normal">
              {`${apiKey.start}…`}
            </code>
          )}
        </ItemTitle>
        <ItemDescription>{details}</ItemDescription>
      </ItemContent>

      <ItemActions>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                aria-label={m.settings_api_keys_revoke_key({
                  key: displayName,
                })}
                disabled={isRevoking}
                variant="ghost"
              />
            }
          >
            {m.settings_api_keys_revoke()}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {m.settings_api_keys_revoke_title({ key: displayName })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {m.settings_api_keys_revoke_description()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{m.settings_cancel()}</AlertDialogCancel>
              <AlertDialogAction
                className="text-destructive hover:text-destructive"
                loading={isRevoking}
                onClick={() => onRevoke(apiKey.id)}
                variant="ghost"
              >
                {m.settings_api_keys_revoke_confirm()}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ItemActions>
    </Item>
  );
};
