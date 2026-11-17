# 007 — Slide the credential sub-steps

- **Status**: DONE
- **Commit**: b0ee1c7
- **Severity**: LOW
- **Category**: Missed opportunities / Cohesion
- **Estimated scope**: 1 file, ~35 lines

## Problem

`CredentialSequence` walks the operator through a provider's credentials one field at a time ("Step 1 of 3"). Each sub-step remounts by key with no transition:

```tsx
// apps/web/src/features/instance-integration/ui/credential-sequence.tsx:199-202 — current
<div className="flex flex-col gap-4" key={index} ref={focusStep}>
  {renderStep()}
  {isLast && variant.id === POWENS ? <PowensSandboxNote /> : null}
</div>
```

`index` changes through three call sites, all bare `setIndex`:

```tsx
// credential-sequence.tsx:85-93 — current (flag)
const flag = (position: number, problem: FieldProblem) => {
  const at = steps[position];

  if (at?.kind === "field") {
    setProblems((held) => ({ ...held, [at.key]: problem }));
  }

  setIndex(position);
};
```

```tsx
// credential-sequence.tsx:116-120 — current (goForward)
if (move.kind === "step") {
  setIndex(move.index);
} else {
  save(true);
}
```

```tsx
// credential-sequence.tsx:125-131 — current (goBack)
const move = stepBefore(index);

if (move.kind === "step") {
  setIndex(move.index);
} else {
  onBack();
}
```

The rest of the wizard slides directionally (`wizard-shell.tsx`), so these field swaps are the only forward/back moves that teleport.

## Target

A smaller, quicker cousin of the wizard slide — this is a move _within_ a step, so it travels half as far, uses no blur, and uses the crisp tier:

```ts
// target values
const SUB_STEP_SHIFT_PX = 8;
const NO_SUB_STEP_SHIFT_PX = 0;

interface SubStepMotion {
  direction: 1 | -1;
  shift: number;
}

const subStepVariants = {
  center: { opacity: 1, transition: spring.moderate, x: 0 },
  enter: ({ direction, shift }: SubStepMotion) => ({
    opacity: 0,
    x: direction * shift,
  }),
  exit: ({ direction, shift }: SubStepMotion) => ({
    opacity: 0,
    transition: spring.moderate.exit,
    x: -direction * shift,
  }),
};
// spring.moderate      = { type: "spring", duration: 0.16, bounce: 0 }
// spring.moderate.exit = { duration: 0.12 }
```

- `AnimatePresence mode="popLayout" initial={false}` inside a `relative` wrapper (popLayout absolutely positions the exiting child against the nearest positioned ancestor — without the wrapper it would jump to the wizard column).
- Direction **+1** when the new index is greater, **−1** when smaller.
- Reduced motion: shift `0` → opacity crossfade only.
- Focus: the existing `focusStep` callback ref must stay on the **entering** element so the first input is focused on mount, exactly as today.

## Repo conventions to follow

- Directional `custom` variants exemplar: `apps/web/src/shared/ui/wizard/wizard-shell.tsx:14-37,59-62,92-103` (`StepMotion`, `stepVariants`, `useReducedMotion` → shift 0). Mirror its naming and shape.
- `spring` tokens: `import { spring } from "@freenary/ui/lib/springs";`.
- Imports: external packages first, then `@/`, then relative. No comments in code.

## Steps

1. In `credential-sequence.tsx` add imports: `import { spring } from "@freenary/ui/lib/springs";` (with the other `@freenary/ui` imports) and `import { AnimatePresence, motion, useReducedMotion } from "motion/react";`.
2. Add `SUB_STEP_SHIFT_PX`, `NO_SUB_STEP_SHIFT_PX`, `SubStepMotion` and `subStepVariants` from **Target** at module level, below `STEP_TITLE`.
3. In the component, after `const [index, setIndex] = useState(0);` add:
   ```ts
   const [direction, setDirection] = useState<1 | -1>(1);
   const prefersReducedMotion = useReducedMotion();
   const subStepMotion: SubStepMotion = {
     direction,
     shift: prefersReducedMotion ? NO_SUB_STEP_SHIFT_PX : SUB_STEP_SHIFT_PX,
   };

   const moveTo = (position: number) => {
     setDirection(position < index ? -1 : 1);
     setIndex(position);
   };
   ```
4. Replace the three `setIndex(...)` calls shown in **Problem** (in `flag`, `goForward`, `goBack`) with `moveTo(...)` using the same argument.
5. Replace the keyed `<div … key={index} ref={focusStep}>…</div>` (lines 199-202) with:
   ```tsx
   <div className="relative">
     <AnimatePresence custom={subStepMotion} initial={false} mode="popLayout">
       <motion.div
         key={index}
         animate="center"
         className="flex flex-col gap-4"
         custom={subStepMotion}
         exit="exit"
         initial="enter"
         ref={focusStep}
         variants={subStepVariants}
       >
         {renderStep()}
         {isLast && variant.id === POWENS ? <PowensSandboxNote /> : null}
       </motion.div>
     </AnimatePresence>
   </div>
   ```

## Boundaries

- Do NOT change `focusStep`, `handleSubmit`, validation, or the "Step n of m" counter (`aria-live` stays as is).
- Do NOT touch `OutcomeNotice` (plan 006) or `ProviderStep` (plan 004).
- Do NOT add blur — the wizard-level slide owns that.
- Do NOT add dependencies.
- If the code does not match the excerpts above, STOP and report.

## Verification

- **Mechanical**: `bun run check-types` passes; `bun x ultracite check` reports no new findings for `credential-sequence.tsx`; `bun test apps/web/src/features/instance-integration` passes.
- **Feel check**: `bun run dev:up`, `/setup` as operator, choose a provider with several credential fields (e.g. Powens) → Continue:
  - **Next**: the next field enters from 8px right while the previous leaves 8px left; quick and crisp, no blur, no bounce.
  - **Back**: reversed.
  - The first input of each sub-step is focused as soon as it appears (type immediately after pressing Enter).
  - Submit an empty required field on the last step so validation jumps back to an earlier field: it slides in from the left.
  - Press Enter rapidly through all fields: no stacked or orphaned fields.
  - Settings → the same provider in the integration dialog: same behaviour; nothing escapes the dialog during the slide.
  - DevTools → Rendering → `prefers-reduced-motion: reduce`: crossfade in place, no travel.
- **GIF (required)**: record Next → Next → Back at normal speed:
  ```bash
  mkdir -p /tmp/freenary-gifs
  screencapture -v -V 8 -R<x>,<y>,<w>,<h> /tmp/freenary-gifs/007.mov
  ffmpeg -y -i /tmp/freenary-gifs/007.mov \
    -vf "fps=30,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5" \
    -loop 0 /tmp/freenary-gifs/007-credential-substeps.gif
  ```
  Hand it back with the result as `![…](/tmp/freenary-gifs/007-credential-substeps.gif)`. Fake values only. Do not commit the GIF.
- **Done when**: every sub-step change slides in its direction and focus behaviour is unchanged.
