import { Button } from "@freenary/ui/components/button";
import { useFluidHover } from "@freenary/ui/hooks/use-fluid-hover";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

import { authApiKeysQueryOptions } from "../api/auth-queries";
import { useApiKeyActions } from "../model/use-api-key-actions";
import { SecurityApiKeyCreateDialog } from "./security-api-key-create-dialog";
import { SecurityApiKeyRow } from "./security-api-key-row";
import { SecurityRowsSkeleton } from "./security-rows-skeleton";
import { SettingsRowList } from "./settings-row-list";
import { SettingsPane } from "./settings-section";

export const SecurityApiKeysSection = () => {
  const {
    data: apiKeys,
    error,
    isPending,
  } = useQuery(authApiKeysQueryOptions());

  const { create, isCreating, revoke, revokingId } = useApiKeyActions();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const hover = useFluidHover(listRef, {
    axis: "y",
    gapClick: false,
    nearest: true,
  });

  const locale = getLocale();
  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale]
  );

  const renderRows = () => {
    if (isPending) {
      return (
        <SecurityRowsSkeleton loadingLabel={m.settings_api_keys_loading()} />
      );
    }

    if (error) {
      return (
        <p className="text-muted-foreground">
          {m.settings_api_keys_load_error()}
        </p>
      );
    }

    if (apiKeys.length === 0) {
      return (
        <p className="text-muted-foreground">
          {m.settings_api_keys_empty_explanation()}
        </p>
      );
    }

    return (
      <SettingsRowList hover={hover} ref={listRef}>
        {apiKeys.map((apiKey, index) => (
          <SecurityApiKeyRow
            apiKey={apiKey}
            formatter={formatter}
            index={index}
            isRevoking={revokingId === apiKey.id}
            key={apiKey.id}
            onRevoke={revoke}
            registerItem={hover.registerItem}
          />
        ))}
      </SettingsRowList>
    );
  };

  return (
    <SettingsPane
      action={
        <Button onClick={() => setIsCreateOpen(true)}>
          {m.settings_api_keys_create()}
        </Button>
      }
      description={m.settings_api_keys_description()}
      title={m.settings_tab_api_keys()}
    >
      {renderRows()}

      <SecurityApiKeyCreateDialog
        isCreating={isCreating}
        onCreate={create}
        onOpenChange={setIsCreateOpen}
        open={isCreateOpen}
      />
    </SettingsPane>
  );
};
