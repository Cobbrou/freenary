# Animation plans

Written by the `improve-animations` skill. Plans 001–003 were written against commit `66f3199`; plans 004–009 against `b0ee1c7`.

| # | Title | Severity | Status |
| --- | --- | --- | --- |
| [001](001-auth-form-credential-reveal.md) | Animate the sign-in credential reveal | HIGH | DONE |
| [002](002-onboarding-step-transitions.md) | Animate the onboarding step and skeleton swaps | MEDIUM | DONE |
| [003](003-onboarding-stepper-progress.md) | Animate the onboarding stepper's progress | LOW | DONE |
| [004](004-setup-provider-phase-transitions.md) | Slide between the setup provider choice, credentials and restart screens | MEDIUM | DONE |
| [005](005-auth-heading-in-step-transition.md) | Move the sign-in heading into the step transition | MEDIUM | TODO |
| [006](006-setup-outcome-notice-reveal.md) | Reveal the setup outcome notice instead of popping it in | LOW | DONE |
| [007](007-credential-substep-slide.md) | Slide the credential sub-steps | LOW | DONE |
| [008](008-wizard-avatar-reactions.md) | Let the wizard avatar react during setup and onboarding | LOW | DONE |
| [009](009-signup-name-field-reveal.md) | Reveal the sign-up name field | LOW | TODO |

## Order and dependencies

Recommended order, by impact relative to effort: **004 → 005 → 006 → 007 → 008 → 009**.

1. **001–003** are done. Files from those plans that have since moved are referenced by their current paths in 004–009.
2. **004 before 008.** Both edit `apps/web/src/pages/setup/ui/setup-page.tsx` (004 changes `stepKey` and `ProviderStep` props; 008 adds `avatarState`). 008 tolerates 004's changes; the reverse merge is messier.
3. **005 and 009** both touch `/login`, but in different files (`auth-form.tsx` and `auth-credentials-step.tsx`). Either order works.
4. **006 and 007** both live in `features/instance-integration/ui` but in different files (`outcome-notice.tsx` and `credential-sequence.tsx`). Either order works.

## Shared values

These plans add no new easing or duration tokens. They reuse the repo's own motion vocabulary:

- `spring` tiers from `packages/ui/src/lib/springs.ts`:
  - `moderate`: `{ type: "spring", duration: 0.16, bounce: 0 }`, exit `{ duration: 0.12 }`
  - `slow`: `{ type: "spring", duration: 0.24, bounce: 0.12 }`, exit `{ duration: 0.16 }`
- The directional `stepVariants` in `apps/web/src/shared/ui/wizard/wizard-shell.tsx:14-37`: 16px shift with a `blur(4px)` mask.
- Height reveals clip with `overflow: hidden` only while animating. Each one cancels its parent's flex `gap` with a negative top margin plus matching top padding, so the layout at rest stays identical.
- The brand avatar's own state engine (`packages/ui/src/lib/brand-avatar/states.ts`) for plan 008.

## Demo GIFs

Every plan's Verification section requires a GIF of the running result, recorded at normal speed and converted with `ffmpeg`. Save it to `/tmp/freenary-gifs/NNN-*.gif` and return it alongside the result. Record fake data only, and never commit a GIF.
