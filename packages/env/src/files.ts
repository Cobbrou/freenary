import { readFileSync, statSync } from "node:fs";

const TRAILING_NEWLINE = /\r?\n$/u;

export const readVariableFiles = (
  source: Record<string, string | undefined>,
  names: Iterable<string>
): string[] => {
  const errors: string[] = [];

  for (const name of names) {
    const path = source[`${name}_FILE`];

    if (!path) {
      continue;
    }

    if (source[name]) {
      errors.push(`${name}_FILE: ${name} is set too. Set only one of them.`);

      continue;
    }

    if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
      errors.push(`${name}_FILE: ${path} is not a readable file.`);

      continue;
    }

    source[name] = readFileSync(path, "utf-8").replace(TRAILING_NEWLINE, "");
  }

  return errors;
};
