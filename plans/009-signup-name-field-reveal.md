# 009 — Reveal the sign-up name field

- **Status**: DONE
- **Commit**: b0ee1c7
- **Severity**: LOW
- **Category**: Missed opportunities / Interruptibility
- **Estimated scope**: 1 file, ~30 lines

## Problem

On `/login`, **Create an account** flips the credentials step into sign-up mode. The name field mounts between email and password in one frame, shoving the password field, the submit button and every option below it down by ~70px; switching back removes it the same way:

```tsx
// apps/web/src/pages/login/ui/auth-credentials-step.tsx:113-130 — current
{
  isSignUp && (
    <form.Field name="name">
      {(field) => (
        <AuthFormField
          autoComplete="name"
          autoFocus
          errors={field.state.meta.errors.map((error) => error?.message)}
          id={field.name}
          label={m.auth_name_label()}
          placeholder={m.auth_name_placeholder()}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={field.handleChange}
        />
      )}
    </form.Field>
  );
}
```

The toggle is a button the user can press again mid-change, so the motion must retarget, not restart.

## Target

Height + opacity reveal that grows the field open between email and password, using the repo's spring token (`packages/ui/src/lib/springs.ts`):

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
- `overflow: hidden` only while animating, `visible` once settled (the input's `ring-2` focus ring, `packages/ui/src/components/input-addons.tsx:16`, sits outside the box)
- reduced motion: field appears at full height with a 150ms fade; leaves instantly
- `AnimatePresence initial={false}` (sign-in mode is the default, nothing to animate on mount)
- springs retarget mid-flight, so pressing the toggle twice reverses smoothly

**Gap handling.** The field sits in `FieldGroup`, which is `flex flex-col gap-4` (`packages/ui/src/components/field.tsx:43`). A height-0 child still takes the 16px gap, which would then appear/vanish in one frame. Cancel it: the animated wrapper gets `-mt-4`, its inner content `pt-4` — net 0 when collapsed, identical to today when open.

Animating `height` is the documented exception to "transform and opacity only": it is the only way to stop the layout jump, and the subtree is one input.

## Repo conventions to follow

- Reveal precedent with the same overflow/transitionEnd pattern: `plans/001-auth-form-credential-reveal.md` (DONE).
- `useReducedMotion` + `spring` usage in the sibling file: `apps/web/src/pages/login/ui/auth-form.tsx:1-3,72,101-107`.
- External imports first, `@/` next, relative last. No comments; props alphabetical with handlers last on DOM elements.

## Steps

1. In `auth-credentials-step.tsx`, add `import { spring } from "@freenary/ui/lib/springs";` with the other `@freenary/ui` imports and `import { AnimatePresence, motion, useReducedMotion } from "motion/react";` after the `@tanstack/react-form` import.
2. Add `REDUCED_REVEAL` and `INSTANT` from **Target** at module level, below `NAME_MIN_LENGTH`.
3. In the component, after `const [mode, setMode] = useState<AccountMode>("signin");` add `const prefersReducedMotion = useReducedMotion();`.
4. Replace the `{isSignUp && ( <form.Field name="name">…</form.Field> )}` block shown in **Problem** with:
   ```tsx
   <AnimatePresence initial={false}>
     {isSignUp && (
       <motion.div
         key="name"
         animate={{
           height: "auto",
           opacity: 1,
           transitionEnd: { overflow: "visible" },
         }}
         className="-mt-4"
         exit={{
           height: 0,
           opacity: 0,
           overflow: "hidden",
           transition: prefersReducedMotion ? INSTANT : spring.moderate.exit,
         }}
         initial={{ height: 0, opacity: 0, overflow: "hidden" }}
         transition={prefersReducedMotion ? REDUCED_REVEAL : spring.moderate}
       >
         <div className="pt-4">
           {/* the existing <form.Field name="name">…</form.Field>, verbatim */}
         </div>
       </motion.div>
     )}
   </AnimatePresence>
   ```
   Move the existing `form.Field` JSX inside unchanged (including `autoFocus`). Do not keep the `{/* … */}` placeholder — it is only marking where the field goes.

## Boundaries

- Do NOT animate the **Forgot password?** button or the submit label swap.
- Do NOT touch `auth-form.tsx` (plan 005), `auth-form-field.tsx`, or the schema.
- Do NOT add dependencies.
- If the code does not match the excerpt above, STOP and report.

## Verification

- **Mechanical**: `bun run check-types` passes; `bun x ultracite check` reports no new findings for `auth-credentials-step.tsx`.
- **Feel check**: `bun run dev:up`, open `/login`:
  - **Create an account**: the name field grows open between email and password; password and buttons glide down; the name input gets focus and its focus ring is unclipped once settled.
  - **Sign in instead**: the field collapses; no leftover 16px gap.
  - Double-click the toggle quickly: the field reverses mid-flight instead of snapping or restarting.
  - Submit sign-up with an empty name: the error appears under the field; nothing is clipped.
  - DevTools → Animations at 10%: no overshoot; collapse (120ms) is quicker than reveal (160ms).
  - DevTools → Rendering → `prefers-reduced-motion: reduce`: the field fades in at full height, disappears instantly.
- **GIF (required)**: record Create an account → Sign in instead → Create an account at normal speed:
  ```bash
  mkdir -p /tmp/freenary-gifs
  screencapture -v -V 8 -R<x>,<y>,<w>,<h> /tmp/freenary-gifs/009.mov
  ffmpeg -y -i /tmp/freenary-gifs/009.mov \
    -vf "fps=30,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5" \
    -loop 0 /tmp/freenary-gifs/009-signup-name.gif
  ```
  Hand it back with the result as `![…](/tmp/freenary-gifs/009-signup-name.gif)`. Fake data only. Do not commit the GIF.
- **Done when**: the mode toggle never moves the form in one frame, and the layout at rest is identical to today.
