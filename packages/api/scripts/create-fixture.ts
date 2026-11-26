import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { Option } from "effect";

import { dataExportSchema } from "../src/lib/data-export";
import { fixtureFromExport } from "../src/providers/mock/fixture/anonymise";
import { pseudonymiserWith } from "../src/providers/mock/fixture/pseudonyms";
import {
  FIXTURE_FILE_EXTENSION,
  FIXTURES_DIR,
  fixtureNameOf,
} from "../src/providers/mock/fixture/replay";

const USAGE = `Usage: bun run fixtures:create -- <export.json> [options]

Turns a Freenary data export into an anonymised fixture for the mock bank.

Options:
  --name <name>    File name of the fixture, without .json (default: the export's)
  --names <names>  Other person names to replace, comma-separated
  --keep <words>   Words never to replace, comma-separated
  --keep-dates     Replay the transactions on their own dates
  --seed <secret>  Secret that makes the pseudonyms the same on every run
  --force          Overwrite a fixture with the same name`;

const SEED_BYTES = 32;
const LIST_SEPARATOR = ",";

const fail: (message: string) => never = (message) => {
  console.error(`${message}\n\n${USAGE}`);

  return process.exit(1);
};

const parseCommandLine = Option.liftThrowable(() =>
  parseArgs({
    allowPositionals: true,
    options: {
      force: { default: false, type: "boolean" },
      keep: { default: [], multiple: true, type: "string" },
      "keep-dates": { default: false, type: "boolean" },
      name: { type: "string" },
      names: { default: [], multiple: true, type: "string" },
      seed: { type: "string" },
    },
  })
);

const readExport = Option.liftThrowable((text: string) =>
  dataExportSchema.safeParse(JSON.parse(text))
);

const listOf = (entries: readonly string[]): string[] =>
  entries.flatMap((entry) =>
    entry.split(LIST_SEPARATOR).flatMap((item) => {
      const trimmed = item.trim();

      return trimmed.length > 0 ? [trimmed] : [];
    })
  );

const commandLine = Option.getOrElse(parseCommandLine(), () =>
  fail("Unknown option.")
);

const [exportPath] = commandLine.positionals;

if (!exportPath) {
  fail("Name the export file to read.");
}

const inputPath = path.resolve(exportPath);

if (!existsSync(inputPath)) {
  fail(`${inputPath} does not exist.`);
}

const parsedExport = Option.getOrElse(
  readExport(readFileSync(inputPath, "utf-8")),
  () => fail(`${inputPath} is not JSON.`)
);

if (!parsedExport.success) {
  fail(
    `${inputPath} is not a Freenary data export:\n${parsedExport.error.issues
      .slice(0, 5)
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")}`
  );
}

const name = fixtureNameOf(commandLine.values.name ?? inputPath);

if (name.length === 0) {
  fail("Give the fixture a name made of letters or digits.");
}

const outputPath = path.join(FIXTURES_DIR, `${name}${FIXTURE_FILE_EXTENSION}`);

if (existsSync(outputPath) && !commandLine.values.force) {
  fail(`${outputPath} already exists. Pass --force to overwrite it.`);
}

const { fixture, report } = fixtureFromExport(parsedExport.data, {
  extraNames: listOf(commandLine.values.names),
  keptWords: listOf(commandLine.values.keep),
  pseudonymiser: pseudonymiserWith(
    commandLine.values.seed ?? randomBytes(SEED_BYTES).toString("hex")
  ),
  shiftDates: !commandLine.values["keep-dates"],
});

mkdirSync(FIXTURES_DIR, { recursive: true });

writeFileSync(outputPath, `${JSON.stringify(fixture, null, 2)}\n`);

console.log(`Fixture written to ${path.relative(process.cwd(), outputPath)}`);

console.log(
  `  ${report.connections} connections, ${report.accounts} accounts, ${report.transactions} transactions`
);

console.log("\nNames replaced, in every text of the fixture:");

console.log(
  report.names.length > 0
    ? report.names
        .map(({ original, replacement }) => `  ${original} -> ${replacement}`)
        .join("\n")
    : "  none"
);

if (report.cardMerchantNames.length > 0) {
  console.log(
    `\nReplaced names that card payments use too. Pass each merchant's with --keep: ${report.cardMerchantNames.join(", ")}`
  );
}

console.log(
  "\nFirst names still in the fixture. Check each one: pass a person's name with --names, or a merchant's with --keep."
);

console.log(
  report.suspects.length > 0 ? `  ${report.suspects.join(", ")}` : "  none"
);
