# 005 — Move the sign-in heading into the step transition

- **Status**: DONE
- **Commit**: b0ee1c7
- **Severity**: MEDIUM
- **Category**: Cohesion / Missed opportunities
- **Estimated scope**: 1 file, ~3 lines moved

## Problem

The sign-in form fades between its steps (credentials, confirm, reset-request, reset, two-factor), but the heading sits outside the animated element:

```tsx
// apps/web/src/pages/login/ui/auth-form.tsx:90-108 — current
  return (
    <div {...avatar.handlers}>
      <BrandAvatar className="mb-6" size={56} state={avatar.state} />

      <AuthHeader description={heading.description} title={heading.title} />

      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={flow.step}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            transition: prefersReducedMotion
              ? { duration: 0 }
              : spring.moderate.exit,
            y: STEP_EXIT_OFFSET,
          }}
          initial={{ opacity: 0, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : spring.moderate}
        >
```

With `mode="wait"`, the old step's form keeps exiting for 120ms while the **new** title and description ("Check your email", "Two-factor authentication", …) are already on screen. For that beat the heading and the form underneath it disagree, and the heading itself changes in one frame.

## Target

Heading and form are one unit: they exit together and enter together, using the values already in this file — no new values:

- exit: `opacity 0`, `y: 12` (`STEP_EXIT_OFFSET`), `transition: spring.moderate.exit` = `{ duration: 0.12 }`
- enter: `opacity 0 → 1`, `transition: spring.moderate` = `{ type: "spring", duration: 0.16, bounce: 0 }`
- reduced motion: `{ duration: 0 }` (already in place)

The `BrandAvatar` stays outside the animated element: it is the persistent anchor across steps and reacts on its own.

## Repo conventions to follow

- `spring` tokens come from `@freenary/ui/lib/springs` (`packages/ui/src/lib/springs.ts`), already imported in this file.
- No comments in code (`oxslop/no-comments`).

## Steps

1. In `apps/web/src/pages/login/ui/auth-form.tsx`, delete the line
   ```tsx
   <AuthHeader description={heading.description} title={heading.title} />
   ```
   and its following blank line from between `<BrandAvatar … />` and `<AnimatePresence …>`.
2. Insert the same line as the **first child** of the `<motion.div key={flow.step} …>`, directly above `{flow.step === "credentials" && (`.

That is the whole change.

## Boundaries

- Do NOT change any transition value, `mode`, or the `initial={false}` on `AnimatePresence`.
- Do NOT move `BrandAvatar`.
- Do NOT touch `auth-header.tsx` or any step component.
- If the code does not match the excerpt above, STOP and report.

## Verification

- **Mechanical**: `bun run check-types` passes; `bun x ultracite check` reports no new findings for `auth-form.tsx`.
- **Feel check**: `bun run dev:mail` (so the email one-time-code flows are on), open `/login`:
  - Click **Create an account**, submit → the "verify your email" heading and code field fade in together; the old heading and form leave together, drifting 12px down.
  - **Forgot password?** → reset-request step: same.
  - **Use a different email** / back links: same, in reverse.
  - DevTools → Animations at 10%: at no frame is a new title visible above the old form.
  - DevTools → Rendering → `prefers-reduced-motion: reduce`: steps swap instantly, heading and form in the same frame.
- **GIF (required)**: record credentials → Forgot password → back at normal speed, then:
  ```bash
  mkdir -p /tmp/freenary-gifs
  screencapture -v -V 8 -R<x>,<y>,<w>,<h> /tmp/freenary-gifs/005.mov
  ffmpeg -y -i /tmp/freenary-gifs/005.mov \
    -vf "fps=30,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5" \
    -loop 0 /tmp/freenary-gifs/005-auth-heading.gif
  ```
  Hand the GIF back with the result as `![…](/tmp/freenary-gifs/005-auth-heading.gif)`. Fake addresses only (e.g. `ada@freenary.test`). Do not commit the GIF.
- **Done when**: heading and form always change in the same animation.
