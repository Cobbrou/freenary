import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface PlaceTokenCache {
  tokens: Set<string> | null;
}

const DATA_PATH = path.resolve(
  import.meta.dirname,
  "../../data/place-tokens.json"
);

const state: PlaceTokenCache = { tokens: null };

const readPlaceTokens = (): Set<string> => {
  if (!existsSync(DATA_PATH)) {
    return new Set();
  }

  // SAFETY: the file is a JSON array of strings written by the build script
  const tokens = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as string[];

  return new Set(tokens);
};

const ensureLoaded = (): Set<string> => {
  state.tokens ??= readPlaceTokens();

  return state.tokens;
};

export const isPlaceToken = (token: string): boolean =>
  ensureLoaded().has(token);

export const replacePlaceTokens = (tokens: Iterable<string> | null): void => {
  state.tokens = tokens === null ? null : new Set(tokens);
};
