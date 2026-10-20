import { Field, FieldLabel } from "@freenary/ui/components/field";
import { Input } from "@freenary/ui/components/input";
import { Switch } from "@freenary/ui/components/switch";
import { Textarea } from "@freenary/ui/components/textarea";
import { useId } from "react";

import { m } from "@/paraglide/messages.js";

import { fieldLabel } from "../model/labels";

const TRUE = "true";
const FALSE = "false";
const SECRET_ROWS = 6;

export interface SetupFieldDescriptor {
  key: string;
  kind: string;
  present: boolean;
  required: boolean;
  source: string;
  value: string | null;
}

interface SetupFieldProps {
  descriptor: SetupFieldDescriptor;
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
  onChange,
  value,
}: SetupFieldProps) => {
  const inputId = useId();
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
    <Field>
      <FieldLabel htmlFor={inputId}>{fieldLabel(descriptor.key)}</FieldLabel>
      {descriptor.kind === "secret-block" ? (
        <Textarea
          id={inputId}
          onChange={(event) => onChange(descriptor.key, event.target.value)}
          placeholder={secretPlaceholder}
          rows={SECRET_ROWS}
          value={value ?? ""}
        />
      ) : (
        <Input
          id={inputId}
          onChange={(event) => onChange(descriptor.key, event.target.value)}
          placeholder={secretPlaceholder}
          type={inputType(descriptor.kind)}
          value={secret ? (value ?? "") : held}
        />
      )}
    </Field>
  );
};
