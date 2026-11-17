# 008 — Let the wizard avatar react during setup and onboarding

- **Status**: DONE
- **Commit**: b0ee1c7
- **Severity**: LOW
- **Category**: Missed opportunities (rare-moment delight / feedback)
- **Estimated scope**: 2 new model files + 1 test, 4 edited files, ~90 lines

## Problem

The sign-in page's `BrandAvatar` reacts to everything — loading, success, error (`apps/web/src/pages/login/model/use-auth-avatar.ts:52-79`). The setup and onboarding wizards render the same avatar frozen in its idle loop:

```tsx
// apps/web/src/shared/ui/wizard/wizard-shell.tsx:66-69 — current
<header className="mx-auto flex min-h-16 w-full max-w-md flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-6">
  <BrandAvatar size={AGENT_PX} />
  {isPending ? null : stepper}
</header>
```

These are first-run, once-per-person flows — the one place the delight budget is meant to be spent — and they include real moments worth acknowledging: checking credentials against a provider, a provider rejecting them, a server restart, the first bank connected. The avatar engine already animates every one of these states (`packages/ui/src/lib/brand-avatar/states.ts`: `loading` = a coin tossed above the head; `success` = a coin dropped into the slot, a gulp, a hop and a glint; `error` = a decaying head shake then a squint) and already freezes to a still pose under `prefers-reduced-motion` (`packages/ui/src/components/brand-avatar.tsx:145-150`).

## Target

No new motion values: the avatar engine owns every curve and timing. This plan only feeds it a state.

`WizardShell` gains `avatarState?: BrandAvatarState` (default `"idle"`) and shows `"loading"` itself while `isPending` (the skeleton phase).

**Setup** state, highest priority first:

| Condition | State |
| --- | --- |
| `restartPhase === "stalled"` or a completion failure | `error` |
| a check, save or complete mutation is pending, or `restartPhase === "reconnecting"` | `loading` |
| the active integration's outcome is a failure (`isFailedOutcome`) | `error` |
| the active integration has a successful outcome | `success` |
| otherwise | `idle` |

**Onboarding** state:

| Condition                                                 | State     |
| --------------------------------------------------------- | --------- |
| `isCompleting`                                            | `loading` |
| on the bank step (`step === 1`) with `connectedCount > 0` | `success` |
| otherwise                                                 | `idle`    |

Do **not** add a pause or a celebration beat before navigating home after completion — the avatar reacts while the user is on the page, it never delays them.

## Repo conventions to follow

- Pure avatar-state function exemplar: `apps/web/src/pages/assistant/model/avatar-state.ts` (`assistantAvatarState(input): BrandAvatarState`, early returns, alphabetized destructuring). Copy its shape.
- `BrandAvatarState` type import: `import type { BrandAvatarState } from "@freenary/ui/lib/brand-avatar/states";`.
- FSD: new code starts in the page that uses it (`pages/setup/model`, `pages/onboarding/model`). Pages may import from `@/features/instance-integration` through its `index.ts` only.
- Tests live beside the model file and run with `bun test <path>` — exemplar `apps/web/src/pages/setup/model/setup-steps.test.ts`.
- No comments; no nested ternaries; props alphabetical.

## Steps

1. **`apps/web/src/shared/ui/wizard/wizard-shell.tsx`**
   - `import type { BrandAvatarState } from "@freenary/ui/lib/brand-avatar/states";`
   - Add `avatarState?: BrandAvatarState;` as the first field of `WizardShellProps`; destructure `avatarState = "idle",` first.
   - Change `<BrandAvatar size={AGENT_PX} />` to `<BrandAvatar size={AGENT_PX} state={isPending ? "loading" : avatarState} />`.

2. **`apps/web/src/features/instance-integration/index.ts`** — add `export { isFailedOutcome } from "./model/outcome";` next to the `SaveOutcome` type export.

3. **New `apps/web/src/pages/setup/model/avatar-state.ts`**:

   ```ts
   import type { BrandAvatarState } from "@freenary/ui/lib/brand-avatar/states";

   import { isFailedOutcome } from "@/features/instance-integration";
   import type { SaveOutcome } from "@/features/instance-integration";

   export interface SetupAvatarInput {
     hasCompletionFailure: boolean;
     isBusy: boolean;
     outcome: SaveOutcome | undefined;
     restartPhase: "idle" | "reconnecting" | "stalled";
   }

   export const setupAvatarState = ({
     hasCompletionFailure,
     isBusy,
     outcome,
     restartPhase,
   }: SetupAvatarInput): BrandAvatarState => {
     if (restartPhase === "stalled" || hasCompletionFailure) {
       return "error";
     }

     if (isBusy || restartPhase === "reconnecting") {
       return "loading";
     }

     if (outcome === undefined) {
       return "idle";
     }

     return isFailedOutcome(outcome) ? "error" : "success";
   };
   ```

4. **New `apps/web/src/pages/setup/model/avatar-state.test.ts`** — one `it` per row of the Setup table above, plus "stalled wins over busy" and "busy wins over a failed outcome". Use outcomes `{ outcome: "verified" }` and `{ outcome: "probe-failed", reason: "rejected" }`.

5. **`apps/web/src/pages/setup/ui/setup-page.tsx`** — `import { setupAvatarState } from "../model/avatar-state";` and pass to `<WizardShell …>` (first prop, alphabetical):

   ```tsx
   avatarState={setupAvatarState({
     hasCompletionFailure: setup.completionFailure !== null,
     isBusy:
       setup.check.isPending ||
       setup.save.isPending ||
       setup.complete.isPending,
     outcome: outcomes[setup.stepId],
     restartPhase: setup.restartPhase,
   })}
   ```

6. **New `apps/web/src/pages/onboarding/model/avatar-state.ts`**:

   ```ts
   import type { BrandAvatarState } from "@freenary/ui/lib/brand-avatar/states";

   const BANK_STEP = 1;

   export interface OnboardingAvatarInput {
     connectedCount: number;
     isCompleting: boolean;
     step: number;
   }

   export const onboardingAvatarState = ({
     connectedCount,
     isCompleting,
     step,
   }: OnboardingAvatarInput): BrandAvatarState => {
     if (isCompleting) {
       return "loading";
     }

     return step === BANK_STEP && connectedCount > 0 ? "success" : "idle";
   };
   ```

   plus `avatar-state.test.ts` beside it covering the three rows.

7. **`apps/web/src/pages/onboarding/ui/onboarding-wizard.tsx`** — `import { onboardingAvatarState } from "../model/avatar-state";` and pass to `<WizardShell …>` (first prop):
   ```tsx
   avatarState={onboardingAvatarState({ connectedCount, isCompleting, step })}
   ```

## Boundaries

- Do NOT change `BrandAvatar`, `states.ts`, the avatar size, or any motion value.
- Do NOT move or extract `useAuthAvatar` from `pages/login`; the wizard needs no focus/typing reactions.
- Do NOT delay navigation after setup or onboarding completes.
- Do NOT touch `docs/agents/*.md`.
- If plan 004 has landed, `setup-page.tsx` will also carry `isConfiguring`/`onConfiguringChange` and a composite `stepKey` — that is expected; add the prop alongside. Any other mismatch: STOP and report.

## Verification

- **Mechanical**: `bun run check-types` passes; `bun x ultracite check` clean for the touched files; `cd apps/web && bun run lint:fsd` passes; `bun test apps/web/src/pages/setup/model apps/web/src/pages/onboarding/model` passes.
- **Feel check**: `bun run dev:up`:
  - `/setup` while loading: the avatar tosses a coin; when the first step appears it settles to idle.
  - Wrong credentials → check: coin toss while waiting, then a short head shake and a squint that holds while the error notice is shown. Edit a field: back to idle.
  - Correct credentials → check: coin drops into the slot, gulp, hop, glint.
  - Finish with a restart: loading during "Applying"; if it stalls, error.
  - `/onboarding` with the mock bank provider: connect a bank, return to the bank step → success animation plays once and holds; **Finish** → coin toss until the home page loads (no extra wait).
  - DevTools → Rendering → `prefers-reduced-motion: reduce`: each state shows its still pose with no motion.
- **GIF (required)**: record wrong credentials → check → fix → check in setup, at normal speed, cropped to the wizard card so the avatar is legible:
  ```bash
  mkdir -p /tmp/freenary-gifs
  screencapture -v -V 12 -R<x>,<y>,<w>,<h> /tmp/freenary-gifs/008.mov
  ffmpeg -y -i /tmp/freenary-gifs/008.mov \
    -vf "fps=30,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5" \
    -loop 0 /tmp/freenary-gifs/008-wizard-avatar.gif
  ```
  Hand it back with the result as `![…](/tmp/freenary-gifs/008-wizard-avatar.gif)`. Mock bank / fake keys only. Do not commit the GIF.
- **Done when**: both wizards' avatars follow the tables above and no navigation got slower.
