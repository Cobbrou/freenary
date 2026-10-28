import { Button } from "@freenary/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@freenary/ui/components/field";
import { Input } from "@freenary/ui/components/input";
import { useId, useState } from "react";
import type { FormEvent } from "react";

import { m } from "@/paraglide/messages.js";
import { WizardStepHeader } from "@/shared/ui/wizard-step-header";

interface ClaimStepProps {
  error: string | null;
  isClaiming: boolean;
  onClaim: (token: string) => void;
}

export const ClaimStep = ({ error, isClaiming, onClaim }: ClaimStepProps) => {
  const [token, setToken] = useState("");
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const isInvalid = error !== null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onClaim(token);
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <WizardStepHeader
        description={m.setup_claim_description()}
        title={m.setup_claim_title()}
      />

      <Field data-invalid={isInvalid || undefined}>
        <FieldLabel htmlFor={inputId}>{m.setup_claim_token_label()}</FieldLabel>
        <FieldDescription className="text-sm" id={helpId}>
          {m.setup_claim_token_help()}
        </FieldDescription>
        <Input
          aria-describedby={isInvalid ? `${helpId} ${errorId}` : helpId}
          aria-invalid={isInvalid || undefined}
          autoComplete="off"
          id={inputId}
          onChange={(event) => setToken(event.target.value)}
          required
          spellCheck={false}
          value={token}
        />
        {isInvalid ? <FieldError id={errorId}>{error}</FieldError> : null}
      </Field>

      <div className="flex justify-end">
        <Button loading={isClaiming} type="submit">
          {m.setup_claim_action()}
        </Button>
      </div>
    </form>
  );
};
