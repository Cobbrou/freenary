import { Field, FieldError, FieldLabel } from "@freenary/ui/components/field";
import {
  InputGroup,
  InputGroupInput,
} from "@freenary/ui/components/input-addons";
import type { ComponentProps } from "react";

interface AuthFormFieldProps {
  autoComplete: string;
  autoFocus?: boolean;
  errors: (string | undefined)[];
  id: string;
  inputMode?: ComponentProps<"input">["inputMode"];
  label: string;
  maxLength?: number;
  onBlur: () => void;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  value: string;
}

export const AuthFormField = ({
  autoComplete,
  autoFocus,
  errors,
  id,
  inputMode,
  label,
  maxLength,
  onBlur,
  onChange,
  placeholder,
  type,
  value,
}: AuthFormFieldProps) => {
  const isInvalid = errors.length > 0;

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          aria-invalid={isInvalid || undefined}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          id={id}
          inputMode={inputMode}
          maxLength={maxLength}
          name={id}
          placeholder={placeholder}
          type={type}
          value={value}
          onBlur={onBlur}
          onChange={(e) => onChange(e.target.value)}
        />
      </InputGroup>
      <FieldError errors={errors.map((message) => ({ message }))} />
    </Field>
  );
};
