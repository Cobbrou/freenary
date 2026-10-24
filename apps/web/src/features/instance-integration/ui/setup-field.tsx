import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@freenary/ui/components/field";
import { Input } from "@freenary/ui/components/input";
import { Switch } from "@freenary/ui/components/switch";
import { Textarea } from "@freenary/ui/components/textarea";
import { useId } from "react";

import { m } from "@/paraglide/messages.js";

import { fieldHelp, fieldLabel } from "../model/labels";
import { RichText } from "./rich-text";

const TRUE = "true";
const FALSE = "false";
const SECRET_ROWS = 6;

export interface SetupFieldDescriptor {
  key: string;
  kind: string;
  present: boolean;
  required: boolean;
  source: string;
  suggestion: string | null;
  value: string | null;
}

interface SetupFieldProps {
  descriptor: SetupFieldDescriptor;
  error: string | null;
  onChange: (key: string, value: string) => void;
  value: string | undefined;
}

export const isSecretKind = (kind: string): boolean =>
  kind === "secret" || kind === "secret-block";

const inputType = (kind: string): string => {
  if (kind === "secret") {
    return "password";
  }

  return kind === "port" ? "number" : "text";
};

export const SetupField = ({
  descriptor,
  error,
  onChange,
  value,
}: SetupFieldProps) => {
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const help = fieldHelp(descriptor.key);
  const isInvalid = error !== null;
  const describingIds = [
    ...(help === null ? [] : [helpId]),
    ...(isInvalid ? [errorId] : []),
  ];

  const describedBy =
    describingIds.length === 0 ? undefined : describingIds.join(" ");

  const secret = isSecretKind(descriptor.kind);
  const secretPlaceholder =
    secret && descriptor.present ? m.setup_secret_unchanged_hint() : undefined;

  const held = value ?? descriptor.value ?? "";

  if (descriptor.kind === "toggle") {
    return (
      <Field orientation="horizontal">
        <FieldLabel htmlFor={inputId}>{fieldLabel(descriptor.key)}</FieldLabel>
        <Switch
          checked={held === TRUE}
          id={inputId}
          onCheckedChange={(checked) =>
            onChange(descriptor.key, checked ? TRUE : FALSE)
          }
        />
      </Field>
    );
  }

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={inputId}>{fieldLabel(descriptor.key)}</FieldLabel>
      {help === null ? null : (
        <FieldDescription className="text-sm" id={helpId}>
          <RichText parts={help} />
        </FieldDescription>
      )}
      {descriptor.kind === "secret-block" ? (
        <Textarea
          aria-describedby={describedBy}
          aria-invalid={isInvalid || undefined}
          id={inputId}
          onChange={(event) => onChange(descriptor.key, event.target.value)}
          placeholder={secretPlaceholder}
          rows={SECRET_ROWS}
          spellCheck={false}
          value={value ?? ""}
        />
      ) : (
        <Input
          aria-describedby={describedBy}
          aria-invalid={isInvalid || undefined}
          id={inputId}
          onChange={(event) => onChange(descriptor.key, event.target.value)}
          placeholder={secretPlaceholder}
          type={inputType(descriptor.kind)}
          value={secret ? (value ?? "") : held}
        />
      )}
      {isInvalid ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
};
