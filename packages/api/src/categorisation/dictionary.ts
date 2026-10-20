import { createReadStream, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";

import { Option } from "effect";

import { resolveCategorySlug } from "../lib/taxonomy";
import { isInCountryScope } from "./merchant-scope";
import type { DictionaryEntry, Iso3166Alpha2Country } from "./types";
import { isVerificationConfigured, verifySignature } from "./verify";

interface DictionaryMerchant {
  id: string;
  name: string;
  normalisedName: string;
  category: string | null;
  domains: string[];
  source: string;
  aliases: { alias: string; normalisedAlias: string }[];
  countries?: Iso3166Alpha2Country[];
}

interface DictionaryState {
  entries: Map<string, DictionaryEntry> | null;
  loadedScope: Set<Iso3166Alpha2Country> | null;
  loading: Promise<void> | null;
  openBatches: number;
}

const DATA_DIR = path.resolve(import.meta.dirname, "../../data");
const DATA_PATH = path.resolve(DATA_DIR, "merchants.jsonl.gz");

const EVERY_COUNTRY = null;

const state: DictionaryState = {
  entries: null,
  loadedScope: null,
  loading: null,
  openBatches: 0,
};

const loadedScopeCovers = (
  wanted: Set<Iso3166Alpha2Country> | null
): boolean => {
  const { loadedScope } = state;

  if (loadedScope === null) {
    return true;
  }

  if (wanted === null) {
    return false;
  }

  for (const country of wanted) {
    if (!loadedScope.has(country)) {
      return false;
    }
  }

  return true;
};

const indexMerchantLine = (
  line: string,
  target: Map<string, DictionaryEntry>,
  wanted: Set<Iso3166Alpha2Country> | null
): void => {
  // SAFETY: each line is a JSON-serialised DictionaryMerchant written by the build script
  const merchant = JSON.parse(line) as DictionaryMerchant;

  if (merchant.category === null || merchant.category === undefined) {
    return;
  }

  if (!isInCountryScope(merchant.countries, wanted)) {
    return;
  }

  const category = resolveCategorySlug(merchant.category);

  if (category === null) {
    return;
  }

  const entry: DictionaryEntry = {
    category,
    name: merchant.name,
  };

  target.set(merchant.normalisedName, entry);

  for (const { normalisedAlias } of merchant.aliases) {
    if (normalisedAlias && !target.has(normalisedAlias)) {
      target.set(normalisedAlias, entry);
    }
  }
};

const indexedOrSkipped = Option.liftThrowable(indexMerchantLine);

const signatureAccepted = (filePath: string): boolean => {
  const sigPath = `${filePath}.sig`;

  if (!existsSync(sigPath)) {
    console.warn(
      `[categorisation] Dictionary signature missing: ${filePath} — refusing to load`
    );

    return false;
  }

  if (!verifySignature(readFileSync(filePath), readFileSync(sigPath))) {
    console.warn(
      `[categorisation] Dictionary signature invalid: ${filePath} — refusing to load`
    );

    return false;
  }

  return true;
};

const buildDictionaryFromFile = async (
  filePath: string,
  target: Map<string, DictionaryEntry>,
  wanted: Set<Iso3166Alpha2Country> | null
): Promise<Map<string, DictionaryEntry>> => {
  if (!existsSync(filePath)) {
    console.warn(
      `[categorisation] Dictionary file not found: ${filePath} — skipping`
    );

    return target;
  }

  if (isVerificationConfigured() && !signatureAccepted(filePath)) {
    return target;
  }

  const gunzip = createGunzip();
  const stream = createReadStream(filePath).pipe(gunzip);
  const rl = createInterface({
    crlfDelay: Number.POSITIVE_INFINITY,
    input: stream,
  });

  for await (const line of rl) {
    if (line.trim()) {
      indexedOrSkipped(line, target, wanted);
    }
  }

  return target;
};

const widenTo = async (
  wanted: Set<Iso3166Alpha2Country> | null
): Promise<void> => {
  if (state.entries && loadedScopeCovers(wanted)) {
    return;
  }

  const widenedScope =
    wanted === null ? null : new Set([...(state.loadedScope ?? []), ...wanted]);

  state.entries = await buildDictionaryFromFile(
    DATA_PATH,
    new Map(),
    widenedScope
  );

  state.loadedScope = widenedScope;
};

const ensureLoaded = async (
  wanted: Set<Iso3166Alpha2Country> | null
): Promise<void> => {
  if (state.entries && loadedScopeCovers(wanted)) {
    return;
  }

  const queuedBehind = state.loading;

  state.loading = (async () => {
    if (queuedBehind) {
      await queuedBehind.then(Option.some, Option.none);
    }

    await widenTo(wanted);
  })();

  await state.loading;
};

export const loadDictionary = async (
  countries: Iso3166Alpha2Country[] | undefined
): Promise<void> => {
  state.openBatches += 1;

  const wanted =
    countries && countries.length > 0
      ? new Set(countries.map((country) => country.toUpperCase()))
      : EVERY_COUNTRY;

  const loaded = await ensureLoaded(wanted).then(Option.some, Option.none);

  if (Option.isNone(loaded)) {
    state.entries = new Map();
    state.loadedScope = EVERY_COUNTRY;
    state.loading = null;
  }
};

export const lookupDictionary = async (
  merchantKey: string
): Promise<DictionaryEntry | null> => {
  if (!state.entries) {
    const loaded = await ensureLoaded(EVERY_COUNTRY).then(
      Option.some,
      Option.none
    );

    if (Option.isNone(loaded)) {
      return null;
    }
  }

  return state.entries?.get(merchantKey) ?? null;
};

export const unloadDictionary = (): void => {
  state.openBatches = Math.max(0, state.openBatches - 1);

  if (state.openBatches === 0) {
    state.entries = null;
    state.loadedScope = null;
    state.loading = null;
  }
};
