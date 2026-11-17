# 004 — Slide between the setup provider choice, credentials and restart screens

- **Status**: DONE
- **Commit**: b0ee1c7
- **Severity**: MEDIUM
- **Category**: Missed opportunities / Physicality & origin
- **Estimated scope**: 3 files, ~40 lines

## Problem

The setup wizard slides between integrations, but not between the two phases _inside_ an integration. `WizardShell` (`apps/web/src/shared/ui/wizard/wizard-shell.tsx:92-103`) animates only when `stepKey` changes, and the setup page passes the integration id:

```tsx
// apps/web/src/pages/setup/ui/setup-page.tsx:241-246 — current
  return (
    <WizardShell
      direction={setup.direction}
      isPending={setup.isPending}
      skeleton={<SetupWizardSkeleton />}
      stepKey={setup.stepId}
```

The choice → credentials switch is local state inside `ProviderStep`, so the screen swaps in one frame — the provider radio list is replaced by a credential form with no transition, and the vertically centered column jumps:

```tsx
// apps/web/src/features/instance-integration/ui/provider-step.tsx:58-72 — current
  const [ownChoice, setOwnChoice] = useState(() => initialChoiceOf(descriptor));
  const [isConfiguring, setIsConfiguring] = useState(false);
  const chosen = controlledChoice ?? ownChoice;
  const variant = descriptor.variants.find((entry) => entry.id === chosen);

  const choose = (variantId: string) => {
    setOwnChoice(variantId);
    onChoose?.(variantId);
  };

  if (isConfiguring && variant !== undefined) {
    return (
      <ProviderCredentials
        isBusy={isBusy}
        onBack={() => {
          onEdit();
          setIsConfiguring(false);
        }}
```

```tsx
// apps/web/src/features/instance-integration/ui/provider-step.tsx:98 — current
      onContinue={() => setIsConfiguring(true)}
```

The same teleport happens when Finish triggers a server restart: `setup-page.tsx:52-82` swaps the Finish step for the "Applying" spinner or the "Stalled" screen without a key change.

Every operator crosses this seam once per integration during first-run setup. It is the one place in the wizard where Continue/Back produce no motion, which makes the move read as a glitch next to the integration-to-integration slide.

## Target

Feed the phase into `stepKey` so `WizardShell`'s existing directional slide plays. No new motion values — the shell already defines them (`wizard-shell.tsx:14-37`):

- enter: `opacity 0`, `x = direction × 16px`, `filter: blur(4px)`
- center: `opacity 1`, `x 0`, `blur(0px)`, `transition: spring.slow` = `{ type: "spring", duration: 0.24, bounce: 0.12 }`
- exit: `opacity 0`, `x = −direction × 16px`, `blur(4px)`, `transition: { duration: 0.16 }`
- reduced motion: shift `0` and no blur — a crossfade in place (already handled by the shell via `useReducedMotion`).

Direction: **+1** on Continue (choice → credentials), **−1** on Back (credentials → choice). Restart screens keep whatever direction is current (+1 after Finish).

Phase key:

```ts
// target
const phaseKey =
  setup.restartPhase === "idle"
    ? setup.isConfiguring
      ? "credentials"
      : "choose"
    : setup.restartPhase;
```

…but written without a nested ternary (lint rule) — see Step 3.

`ProviderStep` gets an **optional controlled** `isConfiguring` / `onConfiguringChange` pair, mirroring how `chosen` / `onChoose` are already optional-controlled in the same component. The settings dialog (`apps/web/src/pages/settings/ui/integration-dialog.tsx:85`) passes neither prop and keeps today's uncontrolled behaviour.

## Repo conventions to follow

- Optional controlled prop exemplar, same file: `chosen: controlledChoice` + `ownChoice` state + `onChoose?.()` in `provider-step.tsx:51-66`. Copy that shape exactly.
- Step direction already lives in `useSetup` (`apps/web/src/pages/setup/model/use-setup.ts:41`, `const [direction, setDirection] = useState<1 | -1>(1);`) and is set by `goTo` (`use-setup.ts:64-68`). New state for the phase belongs there too, not in the page component.
- Returned objects and props are alphabetically ordered.
- No comments in code (`oxslop/no-comments`); no nested ternaries; no `try/catch`.

## Steps

1. **`apps/web/src/pages/setup/model/use-setup.ts`**
   - Below `const [direction, setDirection] = useState<1 | -1>(1);` add:
     ```ts
     const [configuringStep, setConfiguringStep] = useState<string | null>(
       null
     );
     ```
   - In `goTo`, add `setConfiguringStep(null);` after `setChosenStep(next);` so moving to another integration always lands on its choice screen.
   - Below `handleBack`, add:
     ```ts
     const handleConfigure = () => {
       setDirection(1);
       setConfiguringStep(stepId);
     };

     const handleLeaveConfigure = () => {
       setDirection(-1);
       setConfiguringStep(null);
     };
     ```
   - Add to the returned object, keeping alphabetical order: `handleConfigure`, `handleLeaveConfigure`, and `isConfiguring: configuringStep === stepId`.

2. **`apps/web/src/features/instance-integration/ui/provider-step.tsx`**
   - In `ProviderStepProps` add (alphabetical positions): `isConfiguring?: boolean;` and `onConfiguringChange?: (isConfiguring: boolean) => void;`.
   - Destructure them as `isConfiguring: controlledIsConfiguring,` and `onConfiguringChange,`.
   - Replace `const [isConfiguring, setIsConfiguring] = useState(false);` with:
     ```ts
     const [ownIsConfiguring, setOwnIsConfiguring] = useState(false);
     const isConfiguring = controlledIsConfiguring ?? ownIsConfiguring;

     const setConfiguring = (next: boolean) => {
       setOwnIsConfiguring(next);
       onConfiguringChange?.(next);
     };
     ```
   - Replace `setIsConfiguring(false);` (inside `onBack`) with `setConfiguring(false);` and `onContinue={() => setIsConfiguring(true)}` with `onContinue={() => setConfiguring(true)}`.

3. **`apps/web/src/pages/setup/ui/setup-page.tsx`**
   - Inside `SetupPage`, before `return (`, add:
     ```ts
     const integrationPhase = setup.isConfiguring ? "credentials" : "choose";
     const phaseKey =
       setup.restartPhase === "idle" ? integrationPhase : setup.restartPhase;
     ```
   - Change `stepKey={setup.stepId}` to ``stepKey={`${setup.stepId}:${phaseKey}`}``.
   - On the `<ProviderStep …>` element (line 200), add these two props in alphabetical position:
     ```tsx
     isConfiguring={setup.isConfiguring}
     onConfiguringChange={(next) =>
       next ? setup.handleConfigure() : setup.handleLeaveConfigure()
     }
     ```

## Boundaries

- Do NOT touch `wizard-shell.tsx` — its variants are the target values.
- Do NOT touch `apps/web/src/pages/settings/ui/integration-dialog.tsx`; the settings dialog must keep uncontrolled behaviour (no props added there).
- Do NOT touch `ProviderChoice`, `ProviderCredentials`, `CredentialSequence` or `OutcomeNotice` (plans 006 and 007 own those).
- Do NOT add a `layout` prop anywhere.
- Do NOT add dependencies.
- If the code does not match the excerpts above (drift since `b0ee1c7`), STOP and report.

## Verification

- **Mechanical**: `bun run check-types` passes; `bun x ultracite check` reports no new findings in the three files; `cd apps/web && bun run lint:fsd` passes.
- **Feel check**: `bun run dev:up`, sign in as the first (operator) account on a fresh database so `/setup` opens:
  - Pick a provider → **Continue**: the credentials form slides in from the right while the choice list leaves to the left, blur-masked; no frame where both are legible.
  - **Back** from credentials: the motion reverses (enters from the left).
  - Save a provider: the next integration slides in from the right as before, and lands on its **choice** screen, not on credentials.
  - Back to a previous integration: it shows its choice screen.
  - Finish with a change that requires a restart: the "Applying" screen crossfades/slides in instead of teleporting.
  - Settings → an integration dialog: Continue/Back inside the dialog behave exactly as before this change.
  - DevTools → Animations at 10%: entering step settles with a barely visible overshoot (bounce 0.12) and never jitters.
  - DevTools → Rendering → `prefers-reduced-motion: reduce`: phase swaps crossfade in place, no slide, no blur.
- **GIF (required)**: record the running app at normal speed showing choice → Continue → credentials → Back → choice, then convert and hand the GIF back with the result (embed it in the report as `![…](/tmp/freenary-gifs/004-setup-provider-phase.gif)`):
  ```bash
  mkdir -p /tmp/freenary-gifs
  # macOS: record ~8s of a screen region (needs Screen Recording permission)
  screencapture -v -V 8 -R<x>,<y>,<w>,<h> /tmp/freenary-gifs/004.mov
  ffmpeg -y -i /tmp/freenary-gifs/004.mov \
    -vf "fps=30,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5" \
    -loop 0 /tmp/freenary-gifs/004-setup-provider-phase.gif
  ```
  Fake data only (mock bank provider, no real keys). Do not commit the GIF.
- **Done when**: no setup screen change happens without motion, direction is readable, and the settings dialog is unchanged.
