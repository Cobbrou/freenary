import { Record as EffectRecord, pipe } from "effect";

const TERM_BOUNDARY = "\u0000";
const TERM_POSITION_PARITY = 2;

export type Term =
  | { readonly emphasis: "code" | "strong"; readonly text: string }
  | { readonly emphasis: "link"; readonly href: string; readonly text: string };

export type MessagePart = (
  | { readonly emphasis: "plain"; readonly text: string }
  | Term
) & { readonly position: number };

export const code = (text: string): Term => ({ emphasis: "code", text });

export const strong = (text: string): Term => ({ emphasis: "strong", text });

export const link = (text: string, href: string): Term => ({
  emphasis: "link",
  href,
  text,
});

const markerOf = (name: string): string =>
  `${TERM_BOUNDARY}${name}${TERM_BOUNDARY}`;

export const messageParts = <Name extends string>(
  message: (inputs: Record<Name, string>) => string,
  terms: Readonly<Record<Name, Term>>
): MessagePart[] => {
  const termsByName = new Map<string, Term>(Object.entries(terms));
  const marked = message(
    pipe(
      terms,
      EffectRecord.map((_term, name) => markerOf(name))
    )
  );

  return marked
    .split(TERM_BOUNDARY)
    .flatMap((segment, position): MessagePart[] => {
      if (position % TERM_POSITION_PARITY === 0) {
        return segment === ""
          ? []
          : [{ emphasis: "plain", position, text: segment }];
      }

      const term = termsByName.get(segment);

      return term === undefined ? [] : [{ ...term, position }];
    });
};
