import { useState } from "react";

export interface ExpandAll {
  value: boolean;
  tick: number;
}

export const useExpandAll = (
  expanded: ExpandAll | undefined,
  fallback: boolean
): [open: boolean, setOpen: (next: boolean) => void] => {
  const [toggle, setToggle] = useState<{ open: boolean; tick?: number }>();
  const toggledSinceLastPress =
    toggle !== undefined && toggle.tick === expanded?.tick;

  const open = toggledSinceLastPress
    ? toggle.open
    : (expanded?.value ?? fallback);

  const setOpen = (next: boolean) =>
    setToggle({ open: next, tick: expanded?.tick });

  return [open, setOpen];
};
