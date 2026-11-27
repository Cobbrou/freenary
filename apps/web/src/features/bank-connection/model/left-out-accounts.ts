import { useSyncExternalStore } from "react";

const NONE: readonly string[] = [];

const listeners = new Set<() => void>();

const store = { leftOut: NONE };

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const rememberLeftOutAccounts = (accountIds: readonly string[]) => {
  store.leftOut = accountIds.length === 0 ? NONE : accountIds;

  for (const listener of listeners) {
    listener();
  }
};

export const forgetLeftOutAccounts = () => rememberLeftOutAccounts(NONE);

export const useLeftOutAccountIds = (): readonly string[] =>
  useSyncExternalStore(
    subscribe,
    () => store.leftOut,
    () => NONE
  );
