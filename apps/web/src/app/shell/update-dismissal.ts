import { Option } from "effect";
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "freenary.update.dismissed";

const listeners = new Set<() => void>();

const session: { dismissed: string | null } = { dismissed: null };

const readStorage = Option.liftThrowable(() =>
  localStorage.getItem(STORAGE_KEY)
);

const writeStorage = Option.liftThrowable((version: string) => {
  localStorage.setItem(STORAGE_KEY, version);
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const readDismissed = (): string | null =>
  Option.getOrElse(readStorage(), () => null) ?? session.dismissed;

const UNKNOWN_UNTIL_HYDRATED = undefined;

export const useDismissedUpdate = (): string | null | undefined =>
  useSyncExternalStore(subscribe, readDismissed, () => UNKNOWN_UNTIL_HYDRATED);

export const dismissUpdate = (version: string) => {
  session.dismissed = version;
  writeStorage(version);

  for (const listener of listeners) {
    listener();
  }
};

export const isBannerShown = (
  latest: string | null,
  dismissed: string | null | undefined
): latest is string =>
  latest !== null && dismissed !== undefined && dismissed !== latest;
