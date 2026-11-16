# `packages/ui` — Shared Design System

Base UI primitives, Fluid Functionalism registry components and Tailwind tokens reused by every React app in the monorepo (`apps/web`, and any future React surface). Centralizing them here keeps the dashboard, marketing, and future apps visually coherent.

## Layout

```
src/
  components/        # Vendored registry primitives (button, dropdown, sidebar, ...)
  hooks/             # Reusable React hooks
  lib/               # cn() and other tiny helpers
    brand-avatar/    # The logo and agent engine — see "The Brand Avatar"
  styles/
    globals.css      # Tailwind v4 layer + design tokens (colors, radii, spacing)
components.json      # Registry config for this package — the `@fluid` and `@bklit` registries and the shadcn CLI
postcss.config.mjs   # Re-exported as @freenary/ui/postcss.config
```

Exports (see `package.json`):

```ts
import { Button } from "@freenary/ui/components/button";
import { cn } from "@freenary/ui/lib/utils";
import "@freenary/ui/globals.css";
```

## Conventions

- **One copy of every primitive lives here.** If `apps/web` needs a Tooltip, add it here from the registry rather than inlining it.
- **Add components with the shadcn CLI targeting this package**, run from repo root. Most primitives come from the `@fluid` registry declared in `components.json`:
  ```bash
  bunx shadcn@latest add @fluid/<component> -c packages/ui
  ```
  The charts under `src/components/charts/` come from the `@bklit` registry the same way (`@bklit/<component>`). A component that already exists is **overwritten, not merged** — read "Vendored Registry Source" below before you fetch one again.
- **App-specific composites** (e.g. a project-switcher built from Button + Popover + Avatar) belong in the app that needs them — a page slice under `apps/web/src/pages/`, or `apps/web/src/shared/ui/` once several pages share one — not here.
- **Design tokens** (colors, radii, font stacks) live in `src/styles/globals.css`. Change them once; every app picks them up.
- **No app imports allowed.** This package depends on React, Base UI and Tailwind, plus the libraries the registry components need — `motion`, `lucide-react`, `@remixicon/react`, `class-variance-authority`, `cn`, `clsx`, `tailwind-merge`, `@number-flow/react`, `d3-array`, `d3-scale`, `d3-shape`, `d3-sankey`, `sonner`, `next-themes`, `date-fns`, `react-day-picker`, `pdfjs-dist`, `tw-animate-css` and `shadcn`. It never depends on `@freenary/api`, `@freenary/db`, or any app workspace. `package.json` is the list that counts; this one goes stale.
- **Never hardcode a user-facing string in a primitive.** Visible text arrives as `children` or a prop from the app. The accessible names for controls with no visible text — "Toggle sidebar", "Loading", "Close" — come from `useUiLabels()` (`src/lib/labels.tsx`), which an app fills via `UiLabelsProvider`; the English defaults there keep the package usable on its own. It now also carries the sidebar, card, command-menu and file-thumbnail strings, which the registry shipped in English. A new primitive with an `aria-label`, `sr-only` line or `alt` adds a field to `UiLabels` and reads it from the hook, so the app that speaks two languages can translate it. This package never imports Paraglide — the labels context is the seam.
- **Accessibility is non-negotiable.** Use the Base UI primitives' built-in ARIA that the registry components build on; follow the React + accessibility rules in the root `CLAUDE.md`.
- **A `cn` upgrade is a restyle until proved otherwise.** `src/lib/utils.test.ts` replays the real merging call sites of the repository against the output of the previous class merger. A release that regroups a class fails it, and CI has no test job, so run `bun test src/lib/utils.test.ts` from this package after any change to the `cn` version — including one a transitive dependency forces through the lockfile. `@shadcn/lint` pins an exact `cn`, and a caret range here lets it move the whole workspace.

## Vendored Registry Source

`src/components/**` is not authored here. It is fetched from the `@fluid` registry and then **hand-patched**, and a re-fetch overwrites those patches silently: the CLI neither merges nor warns. The inventory below is what has to be re-applied afterwards.

The baseline is `mickadesign/fluid-functionalism@e07409c`, vendored 2026-09-10. Diff against **that commit** — `fluidfunctionalism.com/r/*.json` serves `main` and has drifted away from what is vendored here.

| File | Local patch |
| --- | --- |
| `button.tsx` | The Tailwind group is named `group/button`, and every modifier that depends on it is scoped to that name (`group-hover/button:`, `group-active/button:` — 21 of them across the variant table). Upstream's bare `group` also answers a hovered ancestor `.group`, which lights every button inside a hovered row or card. The inner label span gains `w-full min-w-0 [justify-content:inherit]`. The spinner gains `role="status"` and an `aria-label` from the labels seam; the button carries `data-loading` instead of upstream's `aria-busy`, so `disabled:not-data-loading:opacity-50` keeps a loading button at full strength. |
| `menu-item.tsx` | Adds a `trailingIcon` prop, an aria-hidden icon after the label, which the account menu's update rows use for their external-link mark. |
| `dropdown.tsx` | Adds `DropdownGroup` and `DropdownGroupLabel` over Base UI's `Menu.Group` and `Menu.GroupLabel`, which `apps/web/src/app/shell/sidebar-user-menu.tsx` uses to group the update rows under their version. `DropdownLabel` uses literal `text-[11px]` / `text-[12px]` in place of upstream's `typeClass("caption", …)`. |
| `dropdown-search.tsx` | Upstream's `sizeClasses.field` becomes `sizeClasses.text`; this `size-context` has no `field`. |
| `select.tsx`, `combobox.tsx` | `actionsRef` is typed `{ unmount; close }`, which Base UI 1.9's `actionsRef` requires. |
| `switch.tsx` | Not a registry component. Its checked track and focus ring read `--fluid-accent` / `--focus-ring`, as the registry switch does. |
| `command-menu.tsx` | Upstream's `text-caption` class becomes an explicit `text-[11px]` / `text-[12px]`; this repo defines no `text-caption` utility. |
| `card.tsx` | Upstream's `next/link` import becomes a local link shim — this is not a Next app. |
| `combobox.tsx` | Adds `onQueryChange` and `onOpenChange` props, for a list a server filters while it is open; no caller uses them since the Transactions company menu became a search filter. Adds an optional `prefix` on an object item, the `itemPrefix` reader beside `itemValue` / `itemLabel`, and the `aria-hidden` span that renders it inside the chip ahead of the label, used by `apps/web/src/pages/onboarding/ui/country-selection-step.tsx` for a country flag. Losing that one leaves the call site passing `prefix` into nothing and the chips drop their flags without an error. |
| `thinking-steps.tsx` | Adds controlled `open` / `onOpenChange` to `ThinkingStepDetailsProps`, used by `apps/web/src/pages/assistant/ui/assistant-trace.tsx`. The root `ThinkingStepsProps` carries these upstream; the details-level pair is local. |
| `input-message.tsx` | Adds `stopLabel` and `queueLabel` props, used by `apps/web/src/pages/assistant/ui/assistant-chat.tsx`. |
| `thinking-indicator.tsx` | Adds a `words?: string[]` prop, so the cycled words come from the labels seam rather than the component. |
| `calendar.tsx`, `date-picker-core.tsx`, `banner.tsx` | Ported from the October 2026 registry. `@daypicker/react` becomes `react-day-picker` (the former re-exports the latter at the same version). `typeClass` and `fieldTouchClass` come from `lib/type-scale.ts`, since this `size-context` has no `typeClass` and no `SizeClasses.field`. This shape context has no `sharp` variant, so the calendar's `sharp` flag is `false`. `usePopupShape` lives in `lib/shape-context.tsx` and always returns `rounded`. |
| `button.tsx`, `combobox.tsx`, `input-message.tsx`, `thinking-indicator.tsx`, `sidebar-core.tsx`, `sidebar.tsx`, `card.tsx`, `file-thumbnail.tsx`, `command-menu.tsx`, `banner.tsx`, `calendar.tsx`, `date-picker-core.tsx` | English strings replaced by the `UiLabels` seam. |
| Every file | Import paths rewritten from `@/…` to `@freenary/ui/…`, and `framer-motion` imports moved to `motion/react`. |

`oxlint.config.ts` ignores `packages/ui/**` on purpose, so the no-comments rule does not reach these files and the upstream comments stay: a small diff against upstream is worth more here than house style.

That same ignore keeps `@shadcn/lint` off this package, which is correct: a rule such as `no-restyle` protects the design system from its callers, and the components here _are_ the design system. A caller reaches them as `@freenary/ui/components/<name>`, the prefix `apps/web/components.json` declares, so the linter reads their variants and names a real size in its errors.

## The Brand Avatar

`BrandAvatar` (`src/components/brand-avatar.tsx`) draws one piggy bank head in two roles. `state="logo"` is the Freenary logo: a pink squircle whose two top corners rise into ears, with the coin slot cut through it — no eyes, no nose, square to the viewer and still. It is what the favicon and `BrandPattern` draw. Every other state is the agent: the same head with two ink nostrils that fade in with the eyes, and the eyes and motion of [Open Bot Avatar](https://dominikscholz.github.io/open-bot-avatar/) — two dark pill eyes that blink, glance about and turn into happy arcs, a head that floats, hops, tilts, turns as a solid slab, and follows the pointer. On top of that come Freenary's money moments: `saving` drops coin after coin into the slot, `success` drops one and grins, `loading` flips a coin above the head, `notification` lifts one out of the slot, `celebrating` and `rich` toss coins out of it among gold glints, and `rich` and `idle` sweep a shine across the head. The engine behind it lives in `src/lib/brand-avatar/` and is framework-free:

| Module | Owns |
| --- | --- |
| `math.ts` | Easings, oscillators, and Open Bot Avatar's seeded hash, blink schedule and gaze saccades. |
| `shape.ts` | Path commands mapped through a point function on the way out, plus the rounded polygon, the eye pill, the happy arc, the ellipse and the sparkle. |
| `mark.ts` | The mark's geometry and colours: the head, the slot, the snout, the slab depth, the eyes' size and place, and the coin. |
| `pose.ts` | `Pose` — Open Bot Avatar's turn, tilt, lift, squash, gaze, blink and squint as numbers, plus the falling coin, the open coins, the glints and the shine — the mark and agent rest poses, the blend, `attend()` (the turn toward the pointer) and the range guard. |
| `states.ts` | The state library: one `(moment) => Pose` per state, where a moment carries the time, the state's age, the seed, the pointer gaze and whether it is `still`. `idle`, `happy` and `thinking` are Open Bot Avatar's three motions ported value for value, sway damping while attending included; the rest reuse the same levers. All transitions share `TRANSITION_SECONDS`, Open Bot Avatar's 420 ms. |
| `attention.ts` | Turning a pointer position into an eased gaze target, as Open Bot Avatar does. |
| `frame.ts` | A pose turned into the exact paths, and the fixed ordered eye slots a renderer draws. |
| `engine.ts` | Blends the state being left into the state being entered. |

Six rules hold this together, and each one is load-bearing:

- **No clocks below the component.** `engine.sample(t, gaze)` and `brandAvatarFrame(state, t, seed, still)` are pure functions of their inputs, which is what makes the `frozen` prop, the reduced-motion still frame and a DOM-less test suite produce the same image. A `still` frame is Open Bot Avatar's reduced-motion pose — every cycle at rest, no blink, no glance, no hop — so a frozen avatar never shows eyes caught half shut. A state builder that reads `Date.now()` breaks all three at once. The seed comes from `useId`, so each avatar blinks on its own beat and the server and client still render the same first frame.
- **A pose holds nothing but numbers.** That is why blending two states is one pass over the fields. Two kinds of field cannot be halfway and are the exceptions in `blendPose()`. The eye shape (`happyL`, `happyR`) is 0 or 1: it swaps at the midpoint behind closed eyes, so a pill never morphs into an arc on screen. Coins fade rather than slide: a hidden coin fades in where the new state wants it, and a visible one fades out where it was over the first half while the new state's fades in over the second. The choice reads only the source coin, which a transition holds still, so it cannot flip mid-blend and throw a coin across the head.
- **All motion is affine.** Turning, tilting, lifting and squashing map every control point through one function, which transforms the curve exactly, so a frame never resamples a shape. A deformation that is not affine — a wobble, a bend — would need the outline sampled instead.
- **The head turns as a slab.** `frame.ts` stacks copies of the head from its back face to its front face along the turn, in one path whose copies all wind the same way, so the default fill rule unions them into a solid's silhouette. The coin slot is a hole through the whole slab, which is why the renderer cuts it with a mask instead of filling it. The snout sits further forward than the eyes, so it slides further on a turn. Square on, every copy coincides and the path is the bare mark.
- **Props are fixed slots that fade, never come and go.** The pose always carries one falling coin, three open coins, four glints and one shine; a state that does not use them leaves them at rest with zero opacity or size, so any two states still blend. The falling coin is clipped to the region above the slot's line, which is what makes it vanish into the slot. Coin widths and glint sizes are stored as values, never as an ever-growing spin angle, so no blend can unwind a spin. `engine.test.ts` steps every state and several transitions at 240 frames a second and fails on any jump, so a new prop or state is checked for pops the moment it lands.
- **The mark stays the mark.** `logo` has no eyes, no turn and no clock, and `attend()` leaves a pose without eyes alone, so cursor following can never move the logo. Leaving `logo` fades the eyes in over the blend.

The renderer patches `d` and `opacity` on a fixed set of paths instead of re-rendering, so a wall of avatars costs no React commits per frame. Pills are filled and arcs are stroked, so each eye has one slot of each in `EYE_SLOTS`, and the frame shows one at a time. Fills never animate: the head, nostrils, coins, glints and eyes keep their `mark.ts` colours in every theme, because the brand does not follow the theme and the eyes sit on the pink head rather than on the page.

`BrandPattern` (`src/components/brand-pattern.tsx`) is the logo as a surface: the `logo` frame — the head with its coin slot — tiled across an SVG `<pattern>`, for a place that is about the brand rather than about data. It draws the same `brandAvatarFrame("logo", 0)` the favicon does, so the two cannot drift, and it is decorative by construction — `aria-hidden`, no pointer events, brand fills that ignore the theme, and an `opacity-*` class from the caller for how much of them shows.

Nothing here decides _when_ a state applies; callers pass `state`. Triggers belong to the feature that has the context, not to the mark.
