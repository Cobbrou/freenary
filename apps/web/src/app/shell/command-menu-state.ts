import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

let open = false;

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const readOpen = () => open;

const closedOnTheServer = () => false;

export const useCommandMenuOpen = (): boolean =>
  useSyncExternalStore(subscribe, readOpen, closedOnTheServer);

export const setCommandMenuOpen = (next: boolean) => {
  open = next;

  for (const listener of listeners) {
    listener();
  }
};
