import { z } from "zod";

export const absentUnlessOneOf = <T extends string>(allowed: readonly T[]) =>
  z
    .unknown()
    .transform((raw) => {
      const parsed = z.enum(allowed).safeParse(raw);

      return parsed.success ? parsed.data : undefined;
    })
    .optional();

export const absentUnlessNonEmptyText = (maxLength: number) =>
  z
    .unknown()
    .transform((raw) => {
      const parsed = z.coerce.string().safeParse(raw);

      return parsed.success && parsed.data.length > 0
        ? parsed.data.slice(0, maxLength)
        : undefined;
    })
    .optional();

export const absentWhenDefault = <T extends number | string>(
  value: T | undefined,
  fallback: T
): T | undefined =>
  value === undefined || value === fallback ? undefined : value;

export const absentWhenEmpty = <T>(value: T[] | undefined) =>
  value && value.length > 0 ? value : undefined;
