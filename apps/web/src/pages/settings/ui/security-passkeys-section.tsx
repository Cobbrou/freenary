import { Button } from "@freenary/ui/components/button";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { useFluidHover } from "@freenary/ui/hooks/use-fluid-hover";
import { useSize } from "@freenary/ui/lib/size-context";
import { cn } from "@freenary/ui/lib/utils";
import { useMemo, useRef, useState } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { authClient } from "@/shared/auth";
import { useWebAuthnSupport } from "@/shared/lib/use-webauthn-support";

import { usePasskeyActions } from "../model/use-passkey-actions";
import { SecurityPasskeyNameDialog } from "./security-passkey-name-dialog";
import { SecurityPasskeyRow } from "./security-passkey-row";
import { SecurityRowsSkeleton } from "./security-rows-skeleton";
import { SettingsRowList } from "./settings-row-list";
import { SettingsSection } from "./settings-section";

export const SecurityPasskeysSection = () => {
  const { data: passkeys, error, isPending } = authClient.useListPasskeys();
  const { add, isAdding, remove, removingId, rename, renamingId } =
    usePasskeyActions();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const isWebAuthnSupported = useWebAuthnSupport();
  const listRef = useRef<HTMLUListElement>(null);
  const { control } = useSize();
  const hover = useFluidHover(listRef, { axis: "y", gapClick: false });

  const locale = getLocale();
  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale]
  );

  const isResolving = isPending || isWebAuthnSupported === null;

  const renderRows = () => {
    if (isResolving) {
      return (
        <SecurityRowsSkeleton loadingLabel={m.settings_passkeys_loading()} />
      );
    }

    if (error) {
      return (
        <p className="text-muted-foreground">
          {m.settings_passkeys_load_error()}
        </p>
      );
    }

    return (
      <>
        {isWebAuthnSupported === false && (
          <p className="text-muted-foreground">
            {m.settings_passkeys_unavailable()}
          </p>
        )}

        {passkeys === null || passkeys.length === 0 ? (
          <p className="text-muted-foreground">
            {m.settings_passkeys_empty_explanation()}
          </p>
        ) : (
          <SettingsRowList hover={hover} ref={listRef}>
            {passkeys.map((passkey, index) => (
              <SecurityPasskeyRow
                formatter={formatter}
                index={index}
                isRemoving={removingId === passkey.id}
                isRenaming={renamingId === passkey.id}
                key={passkey.id}
                onRemove={remove}
                onRename={rename}
                passkey={passkey}
                registerItem={hover.registerItem}
              />
            ))}
          </SettingsRowList>
        )}
      </>
    );
  };

  const renderAction = () => {
    if (isResolving) {
      return (
        <Skeleton
          aria-hidden="true"
          className={cn("w-28 rounded-md", control)}
        />
      );
    }

    if (isWebAuthnSupported === false) {
      return null;
    }

    return (
      <Button loading={isAdding} onClick={() => setIsAddOpen(true)}>
        {m.settings_passkeys_add()}
      </Button>
    );
  };

  return (
    <SettingsSection
      action={renderAction()}
      description={m.settings_passkeys_description()}
      title={m.settings_passkeys_title()}
    >
      {renderRows()}

      <SecurityPasskeyNameDialog
        confirmLabel={m.settings_passkeys_add_confirm()}
        defaultName={m.settings_passkeys_default_name()}
        description={m.settings_passkeys_add_description()}
        onOpenChange={setIsAddOpen}
        onSubmit={add}
        open={isAddOpen}
        title={m.settings_passkeys_add_title()}
      />
    </SettingsSection>
  );
};
