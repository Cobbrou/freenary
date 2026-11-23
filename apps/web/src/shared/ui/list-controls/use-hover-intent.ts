import { useEffect, useRef } from "react";

const POINTER_REST_BEFORE_INTENT_MS = 80;

export const useHoverIntent = <T>(
  onIntent: ((value: T) => void) | undefined
) => {
  const pointerRestTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(pointerRestTimer.current), []);

  return (value: T) =>
    onIntent === undefined
      ? undefined
      : {
          onPointerEnter: () => {
            window.clearTimeout(pointerRestTimer.current);
            pointerRestTimer.current = window.setTimeout(
              () => onIntent(value),
              POINTER_REST_BEFORE_INTENT_MS
            );
          },
          onPointerLeave: () => window.clearTimeout(pointerRestTimer.current),
        };
};
