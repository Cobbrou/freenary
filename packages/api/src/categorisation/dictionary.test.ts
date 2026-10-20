import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

import {
  loadDictionary,
  lookupDictionary,
  unloadDictionary,
} from "./dictionary";

interface MerchantFixture {
  countries?: string[];
  id: string;
  name: string;
}

const DATA_PATH = path.resolve(
  import.meta.dirname,
  "../../data/merchants.jsonl.gz"
);

const BACKUP_PATH = `${DATA_PATH}.test-backup`;

const merchantLine = ({ countries, id, name }: MerchantFixture): string =>
  JSON.stringify({
    aliases: [
      {
        alias: `${name} Store`,
        normalisedAlias: `${name.toLowerCase()} store`,
      },
    ],
    category: "groceries",
    countries,
    domains: [],
    id,
    name,
    normalisedName: name.toLowerCase(),
    source: "curated",
  });

const writeFixtureAtTheArtifactPath = async (): Promise<void> => {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  const lines = [
    merchantLine({ countries: ["ZZ"], id: "test/zz", name: "Testmart" }),
    merchantLine({ id: "test/global", name: "Worldmart" }),
  ];

  await writeFile(DATA_PATH, gzipSync(`${lines.join("\n")}\n`));
};

const restoreBuildArtifactLeftByAnInterruptedRun = async (): Promise<void> => {
  if (existsSync(BACKUP_PATH)) {
    await rm(DATA_PATH, { force: true });
    await rename(BACKUP_PATH, DATA_PATH);
  }
};

const hideBuildArtifact = async (): Promise<void> => {
  if (existsSync(DATA_PATH)) {
    await rename(DATA_PATH, BACKUP_PATH);
  }
};

describe("dictionary", () => {
  beforeAll(async () => {
    await restoreBuildArtifactLeftByAnInterruptedRun();
    await hideBuildArtifact();
  });

  afterAll(async () => {
    await rm(DATA_PATH, { force: true });

    if (existsSync(BACKUP_PATH)) {
      await rename(BACKUP_PATH, DATA_PATH);
    }
  });

  beforeEach(() => {
    unloadDictionary();
  });

  afterEach(() => {
    unloadDictionary();
  });

  it("loads the artifact from the package's own data directory", async () => {
    await writeFixtureAtTheArtifactPath();
    await loadDictionary(["ZZ"]);

    expect(await lookupDictionary("testmart")).toEqual({
      category: "groceries",
      name: "Testmart",
    });
  });

  it("resolves aliases to the same entry", async () => {
    await writeFixtureAtTheArtifactPath();
    await loadDictionary(["ZZ"]);

    expect(await lookupDictionary("testmart store")).toEqual({
      category: "groceries",
      name: "Testmart",
    });
  });

  it("returns null for a merchant the artifact does not carry", async () => {
    await writeFixtureAtTheArtifactPath();
    await loadDictionary(["ZZ"]);

    expect(await lookupDictionary("no such merchant")).toBeNull();
  });

  it("drops merchants outside the requested country but keeps unscoped ones", async () => {
    await writeFixtureAtTheArtifactPath();
    await loadDictionary(["FR"]);

    expect(await lookupDictionary("testmart")).toBeNull();
    expect(await lookupDictionary("worldmart")).toEqual({
      category: "groceries",
      name: "Worldmart",
    });
  });
});
