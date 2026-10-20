import type { BrandAvatarState } from "@freenary/ui/lib/brand-avatar/states";
import { useEffect, useRef, useState } from "react";
import type { FocusEvent, FormEvent } from "react";

export interface AuthOutcome {
  kind: "error" | "success";
  seq: number;
}

type FieldKind = "secret" | "text" | null;

interface UseAuthAvatarOptions {
  isBusy: boolean;
  outcome: AuthOutcome | null;
}

export interface AuthAvatarHandlers {
  onBlur: (event: FocusEvent<HTMLElement>) => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onInput: (event: FormEvent<HTMLElement>) => void;
}

export interface AuthAvatar {
  handlers: AuthAvatarHandlers;
  state: BrandAvatarState;
}

const ERROR_HOLD_MS = 1600;
const KEYSTROKE_GAP_ENDING_TYPING_MS = 900;

const PROSE_INPUT_TYPES = {
  email: true,
  number: true,
  password: true,
  tel: true,
  text: true,
  url: true,
} satisfies Record<string, true>;

const fieldKindOf = (target: EventTarget | null): FieldKind => {
  if (
    !(target instanceof HTMLInputElement) ||
    !Object.hasOwn(PROSE_INPUT_TYPES, target.type)
  ) {
    return null;
  }

  return target.type === "password" ? "secret" : "text";
};

const pickState = (
  reaction: AuthOutcome["kind"] | null,
  isBusy: boolean,
  field: FieldKind,
  isTyping: boolean
): BrandAvatarState => {
  if (reaction === "success") {
    return "success";
  }

  if (isBusy) {
    return "loading";
  }

  if (reaction === "error") {
    return "error";
  }

  if (field === "secret") {
    return "shy";
  }

  if (isTyping) {
    return "listening";
  }

  return field === null ? "idle" : "curious";
};

export const useAuthAvatar = ({
  isBusy,
  outcome,
}: UseAuthAvatarOptions): AuthAvatar => {
  const [field, setField] = useState<FieldKind>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [expiredErrorSeq, setExpiredErrorSeq] = useState(0);
  const typingTimer = useRef(0);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  useEffect(() => {
    if (outcome?.kind !== "error") {
      return;
    }

    const timer = setTimeout(
      () => setExpiredErrorSeq(outcome.seq),
      ERROR_HOLD_MS
    );

    return () => clearTimeout(timer);
  }, [outcome]);

  const hasOutcomeExpired =
    outcome?.kind === "error" && outcome.seq <= expiredErrorSeq;

  const reaction = outcome === null || hasOutcomeExpired ? null : outcome.kind;

  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    setField(fieldKindOf(event.target));
  };

  const handleFocusHandoff = (event: FocusEvent<HTMLElement>) => {
    setField(fieldKindOf(event.relatedTarget));
  };

  const handleInput = (event: FormEvent<HTMLElement>) => {
    const kind = fieldKindOf(event.target);

    if (kind === null) {
      return;
    }

    setField(kind);
    setIsTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(
      () => setIsTyping(false),
      KEYSTROKE_GAP_ENDING_TYPING_MS
    );
  };

  return {
    handlers: {
      onBlur: handleFocusHandoff,
      onFocus: handleFocus,
      onInput: handleInput,
    },
    state: pickState(reaction, isBusy, field, isTyping),
  };
};
