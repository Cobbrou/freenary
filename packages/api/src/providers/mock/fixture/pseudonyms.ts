import { createHmac } from "node:crypto";

const DIGITS = "0123456789";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGIT = /\d/u;
const UPPER = /[A-Z]/u;
const LOWER = /[a-z]/u;
const BYTES_PER_DIGEST = 32;
const IBAN_SHAPE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/u;
const IBAN_MODULUS = 97n;
const IBAN_CHECK_BASE = 98n;
const LETTER_OFFSET = 55;
const WHITESPACE = /\s/gu;

export interface Pseudonymiser {
  readonly hex: (domain: string, original: string, length: number) => string;
  readonly index: (domain: string, original: string, size: number) => number;
  readonly reshape: (domain: string, original: string) => string;
}

const charFor = (template: string, byte: number): string => {
  if (DIGIT.test(template)) {
    return DIGITS.charAt(byte % DIGITS.length);
  }

  if (UPPER.test(template)) {
    return LETTERS.charAt(byte % LETTERS.length);
  }

  if (LOWER.test(template)) {
    return LETTERS.charAt(byte % LETTERS.length).toLowerCase();
  }

  return template;
};

export const pseudonymiserWith = (key: string): Pseudonymiser => {
  const digest = (domain: string, original: string, round: number): Buffer =>
    createHmac("sha256", key)
      .update(`${domain}\u0000${round}\u0000${original}`)
      .digest();

  const bytes = (domain: string, original: string, count: number): number[] =>
    Array.from({ length: Math.ceil(count / BYTES_PER_DIGEST) }, (_, round) => [
      ...digest(domain, original, round),
    ])
      .flat()
      .slice(0, count);

  return {
    hex: (domain, original, length) =>
      bytes(domain, original, Math.ceil(length / 2))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, length),
    index: (domain, original, size) =>
      digest(domain, original, 0).readUInt32BE(0) % size,
    reshape: (domain, original) => {
      const shape = [...original];
      const random = bytes(domain, original, shape.length);

      return shape
        .map((template, position) => charFor(template, random[position] ?? 0))
        .join("");
    },
  };
};

const ibanRemainder = (rearranged: string): bigint =>
  BigInt(
    [...rearranged]
      .map((character) =>
        DIGIT.test(character)
          ? character
          : String((character.codePointAt(0) ?? 0) - LETTER_OFFSET)
      )
      .join("")
  ) % IBAN_MODULUS;

export const compactIban = (iban: string): string =>
  iban.replaceAll(WHITESPACE, "").toUpperCase();

export const isValidIban = (candidate: string): boolean => {
  const compact = compactIban(candidate);

  return (
    IBAN_SHAPE.test(compact) &&
    ibanRemainder(`${compact.slice(4)}${compact.slice(0, 4)}`) === 1n
  );
};

export const pseudoIban = (
  pseudonymiser: Pseudonymiser,
  iban: string
): string => {
  const compact = compactIban(iban);

  if (!IBAN_SHAPE.test(compact)) {
    return pseudonymiser.reshape("iban", compact);
  }

  const country = compact.slice(0, 2);
  const bban = pseudonymiser.reshape("iban", compact).slice(4);
  const check = IBAN_CHECK_BASE - ibanRemainder(`${bban}${country}00`);

  return `${country}${String(check).padStart(2, "0")}${bban}`;
};
