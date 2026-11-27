import { MAX_EXCLUSION_REASON_LENGTH } from "@freenary/api/lib/exclusion-scope";
import { Button } from "@freenary/ui/components/button";
import { Input } from "@freenary/ui/components/input";
import { cn } from "@freenary/ui/lib/utils";
import { useId, useState } from "react";

import { m } from "@/paraglide/messages.js";

export const ExclusionReasonField = ({
  className,
  disabled = false,
  onSave,
  reason,
}: {
  className?: string;
  disabled?: boolean;
  onSave: (reason: string | null) => void;
  reason: string | null;
}) => {
  const inputId = useId();
  const [draft, setDraft] = useState(reason ?? "");
  const [savedReason, setSavedReason] = useState(reason);

  if (reason !== savedReason) {
    setSavedReason(reason);
    setDraft(reason ?? "");
  }

  const trimmed = draft.trim();
  const isDirty = trimmed !== (reason ?? "");

  return (
    <form
      className={cn("flex flex-col gap-1.5", className)}
      onSubmit={(event) => {
        event.preventDefault();

        if (isDirty) {
          onSave(trimmed.length > 0 ? trimmed : null);
        }
      }}
    >
      <label className="text-muted-foreground text-xs" htmlFor={inputId}>
        {m.exclusion_reason_label()}
      </label>
      <div className="flex items-center gap-2">
        <Input
          autoComplete="off"
          disabled={disabled}
          id={inputId}
          maxLength={MAX_EXCLUSION_REASON_LENGTH}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={m.exclusion_reason_placeholder()}
          value={draft}
        />
        {isDirty ? (
          <Button
            disabled={disabled}
            size="compact"
            type="submit"
            variant="secondary"
          >
            {m.exclusion_reason_save()}
          </Button>
        ) : null}
      </div>
    </form>
  );
};
