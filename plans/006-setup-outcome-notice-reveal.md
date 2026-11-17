# 006 — Reveal the setup outcome notice instead of popping it in

- **Status**: DONE
- **Commit**: b0ee1c7
- **Severity**: LOW
- **Category**: Missed opportunities / Physicality & origin
- **Estimated scope**: 1 file, ~40 lines

## Problem

After **Check** / **Check & save** in setup (and in the settings integration dialog), the result line mounts in one frame and shoves the button row down by its full height:

```tsx
// apps/web/src/features/instance-integration/ui/outcome-notice.tsx:27-35 — current
export const OutcomeNotice = ({ outcome, provider }: OutcomeNoticeProps) => {
  if (outcome === undefined) {
    return null;
  }

  const isFailure = isFailedOutcome(outcome);
  const detail = isFailure ? outcomeDetail(outcome) : null;

  return (
    <div className="flex flex-col gap-1.5">
```

The icon inside already has a polished swap (`outcome-notice.tsx:12-14,45-61`), but only between two outcomes; the notice's own arrival and its disappearance (any field edit clears the outcome via `onEdit`) are instant. The buttons the user is about to press jump under the pointer.

`OutcomeNotice` is rendered in three places, and every parent is `flex flex-col gap-6`:

- `apps/web/src/features/instance-integration/ui/credential-sequence.tsx:204` (parent `<form className="flex flex-col gap-6" …>` at line 183)
- `apps/web/src/features/instance-integration/ui/provider-credentials.tsx:193` (parent at line 150)
- `apps/web/src/features/instance-integration/ui/environment-summary.tsx:142` (parent at line 69)

## Target

The notice grows open and collapses shut; the button row glides instead of jumping. Height + opacity, with the repo's `spring.moderate` token (`packages/ui/src/lib/springs.ts`):

```ts
// target values
// spring.moderate      = { type: "spring", duration: 0.16, bounce: 0 }
// spring.moderate.exit = { duration: 0.12 }
const REDUCED_REVEAL = {
  height: { duration: 0 },
  opacity: { duration: 0.15 },
} as const;
const INSTANT = { duration: 0 } as const;
```

- enter: `height 0 → "auto"`, `opacity 0 → 1`, `transition: spring.moderate`
- exit: `height → 0`, `opacity → 0`, `transition: spring.moderate.exit`
- clip (`overflow: hidden`) only while animating, `overflow: visible` once settled, so the `<details>` focus ring is never cut off
- reduced motion: enter keeps a 150ms opacity fade at full height; exit is instant
- `AnimatePresence initial={false}`: a notice that is already there when its parent mounts does not animate

**Gap handling.** A height-0 child of a `gap-6` flex column still takes the 24px gap, which would then appear/vanish in one frame. Cancel it: the animated wrapper gets `-mt-6` and its inner content `pt-6`. At height 0 the net contribution is 0; fully open it is identical to today's layout.

Measured `height` is the documented exception to "transform and opacity only" — it is the only way to stop the button row from jumping, and the subtree is two lines of text.

## Repo conventions to follow

- `motion` 13 is already a dependency; this file already imports `AnimatePresence, motion` from `motion/react`.
- `spring` tokens: `import { spring } from "@freenary/ui/lib/springs";` — exemplar usage `apps/web/src/shared/ui/wizard/wizard-shell.tsx:78-80`.
- Reduced-motion branching with `useReducedMotion()` — exemplar `apps/web/src/pages/login/ui/auth-form.tsx:72,101-107`.
- Module-level constants in `SCREAMING_SNAKE_CASE` (see `ICON_SWAP` in this file). No comments in code.

## Steps

1. In `outcome-notice.tsx`, change the motion import to `import { AnimatePresence, motion, useReducedMotion } from "motion/react";` and add `import { spring } from "@freenary/ui/lib/springs";` next to the `cn` import.
2. Add `REDUCED_REVEAL` and `INSTANT` from **Target** below `ICON_SHOWN`.
3. Rename the current component to `OutcomeNoticeBody`, change its props to `{ outcome: SaveOutcome; provider: string }` (outcome required), and delete its `if (outcome === undefined) { return null; }` guard. Its JSX is otherwise unchanged. It is not exported.
4. Add the exported wrapper below it:
   ```tsx
   export const OutcomeNotice = ({ outcome, provider }: OutcomeNoticeProps) => {
     const prefersReducedMotion = useReducedMotion();

     return (
       <AnimatePresence initial={false}>
         {outcome === undefined ? null : (
           <motion.div
             key="outcome"
             animate={{
               height: "auto",
               opacity: 1,
               transitionEnd: { overflow: "visible" },
             }}
             className="-mt-6"
             exit={{
               height: 0,
               opacity: 0,
               overflow: "hidden",
               transition: prefersReducedMotion
                 ? INSTANT
                 : spring.moderate.exit,
             }}
             initial={{ height: 0, opacity: 0, overflow: "hidden" }}
             transition={
               prefersReducedMotion ? REDUCED_REVEAL : spring.moderate
             }
           >
             <div className="pt-6">
               <OutcomeNoticeBody outcome={outcome} provider={provider} />
             </div>
           </motion.div>
         )}
       </AnimatePresence>
     );
   };
   ```
5. Keep `OutcomeNoticeProps` (with `outcome: SaveOutcome | undefined`) for the exported wrapper.

## Boundaries

- Do NOT touch the three callers; the fix must live inside `outcome-notice.tsx`. If any caller's parent is no longer `gap-6`, STOP and report (the `-mt-6`/`pt-6` pair depends on it).
- Do NOT change `ICON_SWAP`, `ICON_HIDDEN`, `ICON_SHOWN` or the inner icon `AnimatePresence`.
- Do NOT animate the **Save anyway** button (`credential-sequence.tsx:217`): it sits in a right-aligned group, causes no layout shift, and the notice reveal already explains its arrival.
- Do NOT change `role="alert"` / `role="status"` or any message.
- If the code does not match the excerpt above, STOP and report.

## Verification

- **Mechanical**: `bun run check-types` passes; `bun x ultracite check` reports no new findings for `outcome-notice.tsx`.
- **Feel check**: `bun run dev:up`, open `/setup` as the operator, choose a provider, enter deliberately wrong credentials, press the check/save action:
  - The failure notice grows open; the button row slides down smoothly instead of jumping.
  - Edit a field: the notice collapses shut and the buttons slide back up; no residual 24px gap remains.
  - Fix the credentials and check again: the icon morphs failure → success as before (the notice itself does not collapse and reopen).
  - Expand **Show details**, tab onto its summary: the focus ring is fully visible.
  - Settings → an integration dialog: same behaviour.
  - DevTools → Animations at 10%: nothing overshoots; the collapse is quicker than the reveal (120ms vs 160ms).
  - DevTools → Rendering → `prefers-reduced-motion: reduce`: the notice fades in at full height; it disappears instantly.
- **GIF (required)**: record wrong credentials → check → edit a field → check again, at normal speed:
  ```bash
  mkdir -p /tmp/freenary-gifs
  screencapture -v -V 10 -R<x>,<y>,<w>,<h> /tmp/freenary-gifs/006.mov
  ffmpeg -y -i /tmp/freenary-gifs/006.mov \
    -vf "fps=30,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5" \
    -loop 0 /tmp/freenary-gifs/006-outcome-notice.gif
  ```
  Hand it back with the result as `![…](/tmp/freenary-gifs/006-outcome-notice.gif)`. Use obviously fake keys (e.g. `fake-client-id`). Do not commit the GIF.
- **Done when**: the notice never appears or disappears in one frame, and the layout at rest is pixel-identical to today.
