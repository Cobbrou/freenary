# `packages/ui` — Shared Design System

Base UI primitives, Fluid Functionalism registry components and Tailwind tokens reused by every React app in the monorepo (`apps/web`, and any future React surface). Centralizing them here keeps the dashboard, marketing, and future apps visually coherent.

## Layout

```
src/
  components/        # Vendored registry primitives (button, dropdown, sidebar, ...)
  hooks/             # Reusable React hooks
  lib/               # cn() and other tiny helpers
    brand-avatar/    # The mark's morph engine — see "The Brand Avatar"
  styles/
    globals.css      # Tailwind v4 layer + design tokens (colors, radii, spacing)
components.json      # Registry config for this package — the `@fluid` registry and the shadcn CLI
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
  A component that already exists is **overwritten, not merged** — read "Vendored Registry Source" below before you fetch one again.
- **App-specific composites** (e.g. a project-switcher built from Button + Popover + Avatar) belong in the app that needs them — a page slice under `apps/web/src/pages/`, or `apps/web/src/shared/ui/` once several pages share one — not here.
- **Design tokens** (colors, radii, font stacks) live in `src/styles/globals.css`. Change them once; every app picks them up.
- **No app imports allowed.** This package depends on React, Base UI and Tailwind, plus the libraries the registry components need — `motion`, `lucide-react`, `@remixicon/react`, `class-variance-authority`, `cn`, `recharts`, `d3-scale`, `d3-shape`, `sonner`, `next-themes`, `date-fns`, `react-day-picker`, `pdfjs-dist`, `tw-animate-css` and `shadcn`. It never depends on `@freenary/api`, `@freenary/db`, or any app workspace. `package.json` is the list that counts; this one goes stale.
- **Never hardcode a user-facing string in a primitive.** Visible text arrives as `children` or a prop from the app. The accessible names for controls with no visible text — "Toggle sidebar", "Loading", "Close" — come from `useUiLabels()` (`src/lib/labels.tsx`), which an app fills via `UiLabelsProvider`; the English defaults there keep the package usable on its own. It now also carries the sidebar, card, command-menu and file-thumbnail strings, which the registry shipped in English. A new primitive with an `aria-label`, `sr-only` line or `alt` adds a field to `UiLabels` and reads it from the hook, so the app that speaks two languages can translate it. This package never imports Paraglide — the labels context is the seam.
- **Accessibility is non-negotiable.** Use the Base UI primitives' built-in ARIA that the registry components build on; follow the React + accessibility rules in the root `CLAUDE.md`.
- **A `cn` upgrade is a restyle until proved otherwise.** `src/lib/utils.test.ts` replays the real merging call sites of the repository against the output of the previous class merger. A release that regroups a class fails it, and CI has no test job, so run `bun test src/lib/utils.test.ts` from this package after any change to the `cn` version — including one a transitive dependency forces through the lockfile. `@shadcn/lint` pins an exact `cn`, and a caret range here lets it move the whole workspace.

## Vendored Registry Source

`src/components/**` is not authored here. It is fetched from the `@fluid` registry and then **hand-patched**, and a re-fetch overwrites those patches silently: the CLI neither merges nor warns. The inventory below is what has to be re-applied afterwards.

The baseline is `mickadesign/fluid-functionalism@e07409c`, vendored 2026-09-10. Diff against **that commit** — `fluidfunctionalism.com/r/*.json` serves `main` and has drifted away from what is vendored here.

| File | Local patch |
| --- | --- |
| `button.tsx` | The Tailwind group is named `group/button`, and every modifier that depends on it is scoped to that name (`group-hover/button:`, `group-active/button:` — 21 of them across the variant table). Upstream's bare `group` also answers a hovered ancestor `.group`, which lights every button inside a hovered row or card. The inner label span gains `w-full min-w-0 [justify-content:inherit]`. The spinner gains `role="status"` and an `aria-label` from the labels seam. |
| `menu-item.tsx` | Adds a `submenu?: boolean` prop, a `useIcon("chevron-right")` slot and the chevron markup it renders. Adds a `trailingIcon` prop, an aria-hidden icon after the label, which the account menu's update rows use for their external-link mark. |
| `dropdown.tsx` | Adds a `DropdownSubmenu` component, consumed by `apps/web/src/app/shell/sidebar-user-menu.tsx`. Adds `DropdownGroup` and `DropdownGroupLabel` over Base UI's `Menu.Group` and `Menu.GroupLabel`, which the same menu uses to group the update rows under their version. Adds an `isOwnEvent` helper and guards four of `DropdownMenu`'s handlers with it — `onMouseMove`, `onClick`, `onFocus` and `onBlur`; without them a submenu's events reach the parent popup and drive its highlight. |
| `command-menu.tsx` | Upstream's `text-caption` class becomes an explicit `text-[11px]` / `text-[12px]`; this repo defines no `text-caption` utility. |
| `card.tsx` | Upstream's `next/link` import becomes a local link shim — this is not a Next app. |
| `combobox.tsx` | Adds `onQueryChange` and `onOpenChange` props, for a list a server filters while it is open; no caller uses them since the Transactions company menu became a search filter. Adds an optional `prefix` on an object item, the `itemPrefix` reader beside `itemValue` / `itemLabel`, and the `aria-hidden` span that renders it inside the chip ahead of the label, used by `apps/web/src/pages/onboarding/ui/country-selection-step.tsx` for a country flag. Losing that one leaves the call site passing `prefix` into nothing and the chips drop their flags without an error. |
| `thinking-steps.tsx` | Adds controlled `open` / `onOpenChange` to `ThinkingStepDetailsProps`, used by `apps/web/src/pages/home/ui/assistant-trace.tsx`. The root `ThinkingStepsProps` carries these upstream; the details-level pair is local. |
| `input-message.tsx` | Adds `stopLabel` and `queueLabel` props, used by `apps/web/src/pages/home/ui/assistant-chat.tsx`. |
| `thinking-indicator.tsx` | Adds a `words?: string[]` prop, so the cycled words come from the labels seam rather than the component. |
| `button.tsx`, `combobox.tsx`, `input-message.tsx`, `thinking-indicator.tsx`, `sidebar-core.tsx`, `sidebar.tsx`, `card.tsx`, `file-thumbnail.tsx`, `command-menu.tsx` | English strings replaced by the `UiLabels` seam. |
| Every file | Import paths rewritten from `@/…` to `@freenary/ui/…`, and `framer-motion` imports moved to `motion/react`. |

`oxlint.config.ts` ignores `packages/ui/**` on purpose, so the no-comments rule does not reach these files and the upstream comments stay: a small diff against upstream is worth more here than house style.

That same ignore keeps `@shadcn/lint` off this package, which is correct: a rule such as `no-restyle` protects the design system from its callers, and the components here _are_ the design system. A caller reaches them as `@freenary/ui/components/<name>`, the prefix `apps/web/components.json` declares, so the linter reads their variants and names a real size in its errors.

## The Brand Avatar

`BrandAvatar` (`src/components/brand-avatar.tsx`) is the product mark as a character. `state="logo"` draws exactly the static ring the favicon draws — the same measured proportions, the same three arcs — and every other state morphs out of it. The engine behind it lives in `src/lib/brand-avatar/` and is framework-free:

| Module | Owns |
| --- | --- |
| `math.ts` | Easings, oscillators, the irregular blink schedule. |
| `shape.ts` | The two path primitives: a closed radial blob, and a capsule whose top and bottom edges bow independently. |
| `pose.ts` | `Pose` — the avatar's whole appearance as numbers — plus the blend and the ring-band guard. |
| `states.ts` | The state library: one `(time, age) => Pose` per expression. |
| `frame.ts` | A pose turned into the exact paths, and the fixed ordered slot list a renderer draws. |
| `engine.ts` | Blends the state being left into the state being entered. |

Five rules hold this together, and each one is load-bearing:

- **No clocks below the component.** `engine.sample(t)` and `brandAvatarFrame(state, t)` are pure functions of time, which is what makes `frozenAt`, the reduced-motion still frame and a DOM-less test suite produce the same image. A state builder that reads `Date.now()` breaks all three at once.
- **A pose holds nothing but numbers.** That is why blending two states is one pass over the keys rather than a per-field special case. A colour belongs in a pose as `tintR/G/B`, never as a string.
- **Silhouette harmonics are fixed at 2, 3 and 5.** A `lobes` count as a pose field would blend to a fractional harmonic, which is no longer periodic over a full turn and kinks the seam at twelve o'clock. Add amplitude, never a count.
- **The ring band is the mark.** `resize()` scales both radii together; scaling only the outer edge eats the band. `normalizePose()` is the backstop for a state whose aperture outgrows its body.
- **An angle or a cycle counter needs a period entry.** Anything a state derives from absolute time and feeds to `sin`, `cos` or `fract` — a rotation, an orbit angle, a decor phase — grows without bound, so it goes in `BLOB_CYCLES`, `SECTOR_CYCLES` or `DECOR_CYCLES`. Without one, a transition lerps it and unwinds every turn the state has accumulated: a spinner thirty seconds in sits at 8760 degrees and would strobe two dozen times backwards on its way to rest. `rebaseCycles()` crosses that gap once, at `setState`, so the blend itself stays a plain lerp — resolving the wrap per frame instead re-rounds against a moving target and jumps most of a turn in a single frame.

The renderer patches `d` and `opacity` on a fixed set of paths instead of re-rendering, so a wall of avatars costs no React commits per frame. Adding a decoration therefore means adding a slot to `INK_SLOTS` and its static fill to `INK_STYLES` — the shape list must never change between frames.

`BrandPattern` (`src/components/brand-pattern.tsx`) is the mark as a surface: the `logo` frame tiled across an SVG `<pattern>`, for a place that is about the brand rather than about data. It draws the same `brandAvatarFrame("logo", 0)` the favicon does, so the two cannot drift, and it is decorative by construction — `aria-hidden`, no pointer events, brand fills that ignore the theme, and an `opacity-*` class from the caller for how much of them shows.

Nothing here decides _when_ a state applies; callers pass `state`. Triggers belong to the feature that has the context, not to the mark.
