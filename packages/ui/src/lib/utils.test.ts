import { describe, expect, it } from "bun:test";

import { cn } from "./utils";

// Verbatim class strings from live `cn()` call sites across the repo that
// merge something away, paired with the output clsx + tailwind-merge 3.6.0
// produced before `cn` replaced them. A `cn` release that restyles one fails
// here; CI has no test job, so this is the local gate.
// A call site that picks a branch with a ternary contributes one row per
// branch: flattening both into one call pins a merge that never happens, and
// then a release that correctly groups the two branches fails for no reason.
const MERGED_CALL_SITES: { args: string[]; expected: string; where: string }[] =
  [
    {
      args: [
        "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5",
        "items-center",
      ],
      expected:
        "[&>svg]:text-muted-foreground flex w-full flex-wrap gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 items-center",
      where: "packages/ui/src/components/chart.tsx",
    },
    {
      args: [
        "shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
        "h-2.5 w-2.5",
        "w-1",
        "w-0 border-[1.5px] border-dashed bg-transparent",
        "my-0.5",
      ],
      expected:
        "shrink-0 rounded-[2px] border-(--color-border) h-2.5 w-0 border-[1.5px] border-dashed bg-transparent my-0.5",
      where: "packages/ui/src/components/chart.tsx",
    },
    {
      args: [
        "flex flex-1 justify-between leading-none",
        "items-end",
        "items-center",
      ],
      expected: "flex flex-1 justify-between leading-none items-center",
      where: "packages/ui/src/components/chart.tsx",
    },
    {
      args: [
        "font-medium select-none",
        "text-sm",
        "[&>svg]:text-muted-foreground flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5",
      ],
      expected:
        "font-medium select-none [&>svg]:text-muted-foreground flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5",
      where: "packages/ui/src/components/calendar.tsx",
    },
    {
      args: [
        "flex min-w-0 flex-1 items-center gap-2 transition-colors duration-80",
        "text-foreground",
        "text-muted-foreground",
      ],
      expected:
        "flex min-w-0 flex-1 items-center gap-2 transition-colors duration-80 text-muted-foreground",
      where: "packages/ui/src/components/sidebar-menu.tsx",
    },
    {
      args: [
        "pointer-events-none absolute right-2 z-10 flex h-5 min-w-5 items-center justify-center px-1 tabular-nums",
        "top-1 text-[10px]",
        "top-1.5 text-[11px]",
        "transition-[color,font-variation-settings] duration-80",
        "text-foreground",
        "text-muted-foreground",
      ],
      expected:
        "pointer-events-none absolute right-2 z-10 flex h-5 min-w-5 items-center justify-center px-1 tabular-nums top-1.5 text-[11px] transition-[color,font-variation-settings] duration-80 text-muted-foreground",
      where: "packages/ui/src/components/sidebar-menu.tsx",
    },
    {
      args: [
        "flex aspect-square shrink-0 items-center justify-center ring-1",
        "bg-primary text-primary-foreground ring-primary",
        "bg-secondary text-primary ring-primary",
        "text-muted-foreground ring-border",
      ],
      expected:
        "flex aspect-square shrink-0 items-center justify-center ring-1 bg-secondary text-muted-foreground ring-border",
      where: "apps/web/src/pages/onboarding/ui/onboarding-stepper.tsx",
    },
    {
      args: ["text-foreground", "text-muted-foreground"],
      expected: "text-muted-foreground",
      where: "apps/web/src/pages/onboarding/ui/onboarding-stepper.tsx",
    },
    {
      args: [
        "flex w-full cursor-pointer flex-col gap-1.5 rounded-md p-1 text-start",
        "text-foreground",
        "text-muted-foreground",
      ],
      expected:
        "flex w-full cursor-pointer flex-col gap-1.5 rounded-md p-1 text-start text-muted-foreground",
      where: "apps/web/src/pages/budget/ui/budget-vs-actual-chart.tsx",
    },
    {
      args: [
        "shrink-0 text-[10px]",
        "text-destructive",
        "text-muted-foreground",
      ],
      expected: "shrink-0 text-[10px] text-muted-foreground",
      where: "apps/web/src/pages/budget/ui/budget-vs-actual-chart.tsx",
    },
    {
      args: ["font-medium tabular-nums", "text-success", "text-destructive"],
      expected: "font-medium tabular-nums text-destructive",
      where: "apps/web/src/features/transaction-list/ui/transaction-row.tsx",
    },
    {
      args: [
        "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[11px]",
        "hover:text-foreground cursor-pointer",
        "text-foreground",
        "text-muted-foreground",
      ],
      expected:
        "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] hover:text-foreground cursor-pointer text-muted-foreground",
      where: "apps/web/src/pages/budget/ui/spending-breakdown-chart.tsx",
    },
    {
      args: [
        "text-2xl font-semibold tabular-nums",
        "text-success",
        "text-foreground",
      ],
      expected: "text-2xl font-semibold tabular-nums text-foreground",
      where: "apps/web/src/pages/budget/ui/transaction-detail-drawer.tsx",
    },
    {
      args: [
        "text-fd-muted-foreground mb-1 text-sm font-medium",
        "text-fd-primary",
      ],
      expected: "mb-1 text-sm font-medium text-fd-primary",
      where: "apps/fumadocs/src/shared/ui/ai-search.tsx",
    },
    {
      args: [
        "bg-fd-card text-fd-card-foreground z-30 overflow-hidden [--ai-chat-width:400px] 2xl:[--ai-chat-width:460px]",
        "max-lg:fixed max-lg:inset-x-2 max-lg:inset-y-4 max-lg:rounded-2xl max-lg:border max-lg:shadow-xl",
        "lg:sticky lg:top-0 lg:ms-auto lg:h-dvh lg:border-s lg:in-[#nd-docs-layout]:[grid-area:toc] lg:in-[#nd-notebook-layout]:col-start-5 lg:in-[#nd-notebook-layout]:row-span-full",
        "animate-fd-dialog-in lg:animate-[ask-ai-open_200ms]",
      ],
      expected:
        "bg-fd-card text-fd-card-foreground z-30 overflow-hidden [--ai-chat-width:400px] 2xl:[--ai-chat-width:460px] max-lg:fixed max-lg:inset-x-2 max-lg:inset-y-4 max-lg:rounded-2xl max-lg:border max-lg:shadow-xl lg:sticky lg:top-0 lg:ms-auto lg:h-dvh lg:border-s lg:in-[#nd-docs-layout]:[grid-area:toc] lg:in-[#nd-notebook-layout]:col-start-5 lg:in-[#nd-notebook-layout]:row-span-full animate-fd-dialog-in lg:animate-[ask-ai-open_200ms]",
      where: "apps/fumadocs/src/shared/ui/ai-search.tsx",
    },
    {
      args: [
        "bg-fd-card text-fd-card-foreground z-30 overflow-hidden [--ai-chat-width:400px] 2xl:[--ai-chat-width:460px]",
        "max-lg:fixed max-lg:inset-x-2 max-lg:inset-y-4 max-lg:rounded-2xl max-lg:border max-lg:shadow-xl",
        "lg:sticky lg:top-0 lg:ms-auto lg:h-dvh lg:border-s lg:in-[#nd-docs-layout]:[grid-area:toc] lg:in-[#nd-notebook-layout]:col-start-5 lg:in-[#nd-notebook-layout]:row-span-full",
        "animate-fd-dialog-out lg:animate-[ask-ai-close_200ms]",
      ],
      expected:
        "bg-fd-card text-fd-card-foreground z-30 overflow-hidden [--ai-chat-width:400px] 2xl:[--ai-chat-width:460px] max-lg:fixed max-lg:inset-x-2 max-lg:inset-y-4 max-lg:rounded-2xl max-lg:border max-lg:shadow-xl lg:sticky lg:top-0 lg:ms-auto lg:h-dvh lg:border-s lg:in-[#nd-docs-layout]:[grid-area:toc] lg:in-[#nd-notebook-layout]:col-start-5 lg:in-[#nd-notebook-layout]:row-span-full animate-fd-dialog-out lg:animate-[ask-ai-close_200ms]",
      where: "apps/fumadocs/src/shared/ui/ai-search.tsx",
    },
  ];

describe("cn", () => {
  it("merges every real call site exactly as clsx + tailwind-merge did", () => {
    const actual = MERGED_CALL_SITES.map((site) => ({
      out: cn(site.args),
      where: site.where,
    }));

    expect(actual).toEqual(
      MERGED_CALL_SITES.map((site) => ({
        out: site.expected,
        where: site.where,
      }))
    );
  });

  it("lets a trailing className win over a variant class", () => {
    // Every component forwards `className` last so callers can override the
    // cva variant. That contract is the reason `cn` exists rather than a join.
    expect(cn("bg-primary text-primary-foreground", "bg-background")).toBe(
      "text-primary-foreground bg-background"
    );
    expect(
      cn("rounded-md", undefined, null, "", "rounded-(--cell-radius)")
    ).toBe("rounded-(--cell-radius)");
  });

  it("keeps classes whose conflict is scoped by a different variant", () => {
    expect(cn("flex items-stretch", "md:flex", "items-center")).toBe(
      "flex md:flex items-center"
    );
    expect(
      cn("bg-muted", "hover:bg-muted/60", "data-[state=open]:bg-accent")
    ).toBe("bg-muted hover:bg-muted/60 data-[state=open]:bg-accent");
  });

  it("resolves the Tailwind v4 forms the components rely on", () => {
    // `w-(--sidebar-width)` shorthand and `w-[calc(...)]` are the same group,
    // so the sidebar's collapsed width has to beat its expanded one.
    expect(
      cn("w-(--sidebar-width)", "w-[calc(var(--sidebar-width-icon)+1px)]")
    ).toBe("w-[calc(var(--sidebar-width-icon)+1px)]");
    // An important class outranks a later plain one regardless of order, so
    // both survive the merge.
    expect(cn("border-ring!", "border-destructive")).toBe(
      "border-ring! border-destructive"
    );
  });

  it("flattens the clsx argument forms the call sites pass", () => {
    expect(
      cn("text-sm", [
        "text-base",
        false && "text-lg",
        { "text-2xl": false, "text-xs": true },
      ])
    ).toBe("text-xs");
    expect(cn("p-2", "px-4")).toBe("p-2 px-4");
  });

  it("counts `ease-fluid` as an easing so a caller's curve wins", () => {
    // `--ease-fluid` is a theme token of ours (globals.css). Without the
    // `theme.ease` extension the merge treats it as an unknown class, both
    // easings reach the DOM and CSS source order picks the curve instead of
    // the caller. CollapsibleContent's base class is the live call site.
    expect(
      cn(
        "group/collapsible-content ease-fluid flex h-[var(--collapsible-panel-height)] flex-col overflow-hidden transition-[height] duration-200 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden",
        "ease-out"
      )
    ).toBe(
      "group/collapsible-content flex h-[var(--collapsible-panel-height)] flex-col overflow-hidden transition-[height] duration-200 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden ease-out"
    );
    expect(cn("ease-fluid duration-200", "ease-out")).toBe(
      "duration-200 ease-out"
    );
    expect(cn("ease-out", "ease-fluid")).toBe("ease-fluid");
  });
});
