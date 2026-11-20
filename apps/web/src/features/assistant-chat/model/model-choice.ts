import { useSyncExternalStore } from "react";

export const SERVER_MODEL = "server";

const STORAGE_KEY = "freenary.assistant.model";

const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const read = (): string | null => localStorage.getItem(STORAGE_KEY);

const unknownUntilHydrated = () => null;

export const useRememberedModel = (): string | null =>
  useSyncExternalStore(subscribe, read, unknownUntilHydrated);

export const rememberModel = (modelId: string) => {
  localStorage.setItem(STORAGE_KEY, modelId);

  for (const listener of listeners) {
    listener();
  }
};

export const resolveModelChoice = (
  remembered: string | null,
  serverModel: string | null
): string | null => {
  if (remembered !== null && remembered !== SERVER_MODEL) {
    return remembered;
  }

  return serverModel === null ? null : SERVER_MODEL;
};
