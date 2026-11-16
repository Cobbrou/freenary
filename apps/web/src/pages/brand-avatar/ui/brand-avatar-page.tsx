import { BrandAvatar } from "@freenary/ui/components/brand-avatar";
import { Button } from "@freenary/ui/components/button";
import { FluidHoverHighlight } from "@freenary/ui/components/fluid-hover-highlight";
import {
  useFluidHover,
  useRegisterFluidHoverItem,
} from "@freenary/ui/hooks/use-fluid-hover";
import type { BrandAvatarState } from "@freenary/ui/lib/brand-avatar/states";
import {
  BRAND_AVATAR_STATES,
  TRANSITION_SECONDS,
} from "@freenary/ui/lib/brand-avatar/states";
import { spring } from "@freenary/ui/lib/springs";
import { surfaceClasses } from "@freenary/ui/lib/surface-classes";
import { SurfaceProvider } from "@freenary/ui/lib/surface-context";
import { cn } from "@freenary/ui/lib/utils";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import * as React from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const CYCLE_MS = 1600;
const GRID_SIZES = [16, 24, 40, 56, 88, 128] as const;
const DEMO_SIZES = [56, 88, 176, 240, 320] as const;

const nextStateAfter = (current: BrandAvatarState) =>
  BRAND_AVATAR_STATES[
    (BRAND_AVATAR_STATES.indexOf(current) + 1) % BRAND_AVATAR_STATES.length
  ];

const StateCell = ({
  gridSize,
  index,
  onSelect,
  registerItem,
  selected,
  state,
}: {
  gridSize: number;
  index: number;
  onSelect: () => void;
  registerItem: (index: number, element: HTMLElement | null) => void;
  selected: boolean;
  state: BrandAvatarState;
}) => {
  const cellRef = React.useRef<HTMLButtonElement>(null);
  useRegisterFluidHoverItem(registerItem, index, cellRef);

  return (
    <motion.button
      className={cn(
        "relative z-10 flex flex-col items-center justify-center gap-2 rounded-lg border p-3",
        selected ? "border-primary bg-muted" : "border-border"
      )}
      onClick={onSelect}
      ref={cellRef}
      transition={spring.fast}
      type="button"
      whileTap={{ scale: 0.97 }}
    >
      <div className="flex items-center" style={{ height: gridSize }}>
        <BrandAvatar size={gridSize} state={state} />
      </div>
      <span className="font-mono text-[0.65rem]">{state}</span>
      <span className="text-muted-foreground font-mono text-[0.6rem]">
        {TRANSITION_SECONDS.toFixed(2)}s
      </span>
    </motion.button>
  );
};

export const BrandAvatarPage = () => {
  const [demo, setDemo] = React.useState<BrandAvatarState>("logo");
  const [previous, setPrevious] = React.useState<BrandAvatarState | null>(null);
  const [demoSize, setDemoSize] = React.useState<number>(240);
  const [gridSize, setGridSize] = React.useState<number>(72);
  const [cycling, setCycling] = React.useState(false);
  const [gridReplayNonce, setGridReplayNonce] = React.useState(0);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const hover = useFluidHover(gridRef, { axis: "xy", nearest: true });
  const { setTheme, resolvedTheme } = useTheme();

  const reduced = React.useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);

      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false
  );

  const morphTo = (state: BrandAvatarState) => {
    setPrevious((current) => (state === demo ? current : demo));
    setDemo(state);
  };

  React.useEffect(() => {
    if (!cycling) {
      return;
    }

    const step = setInterval(() => {
      setDemo((current) => {
        setPrevious(current);

        return nextStateAfter(current);
      });
    }, CYCLE_MS);

    return () => clearInterval(step);
  }, [cycling]);

  return (
    <SurfaceProvider value={1}>
      <div
        className={cn("text-foreground min-h-screen p-6", surfaceClasses(1))}
      >
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <h1 className="font-heading mr-auto text-lg font-semibold">
            brand avatar — {BRAND_AVATAR_STATES.length} states
            <span className="text-muted-foreground ml-2 font-mono text-xs font-normal">
              temporary /dev-avatar — click a cell to morph the demo
            </span>
          </h1>
          <Button
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            size="sm"
            variant="tertiary"
          >
            {resolvedTheme === "dark" ? "light" : "dark"}
          </Button>
          <Button
            onClick={() => setCycling((on) => !on)}
            size="sm"
            variant={cycling ? "primary" : "tertiary"}
          >
            {cycling ? "morphing all" : "morph all"}
          </Button>
          {reduced && (
            <span className="text-destructive font-mono text-xs">
              prefers-reduced-motion: reduce — loops are off, frames are frozen
            </span>
          )}
        </header>

        <section className="border-border mb-6 flex flex-wrap items-center gap-8 rounded-xl border p-6">
          <div
            className="flex shrink-0 items-center justify-center"
            style={{ height: demoSize, width: demoSize }}
          >
            <BrandAvatar
              label={`brand avatar, ${demo}`}
              size={demoSize}
              state={demo}
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-mono text-sm">
              {previous ? `${previous} → ` : ""}
              <span className="font-semibold">{demo}</span>
            </p>
            <p className="text-muted-foreground font-mono text-xs">
              blend {TRANSITION_SECONDS.toFixed(2)}s
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {DEMO_SIZES.map((preset) => (
                <Button
                  key={preset}
                  onClick={() => setDemoSize(preset)}
                  size="sm"
                  variant={demoSize === preset ? "primary" : "ghost"}
                >
                  {preset}
                </Button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {BRAND_AVATAR_STATES.map((state) => (
                <Button
                  key={state}
                  onClick={() => morphTo(state)}
                  size="compact"
                  variant={state === demo ? "primary" : "tertiary"}
                >
                  {state}
                </Button>
              ))}
            </div>
          </div>
        </section>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground mr-auto font-mono text-xs">
            every state, live — click one to morph the demo above
          </span>
          {GRID_SIZES.map((preset) => (
            <Button
              key={preset}
              onClick={() => setGridSize(preset)}
              size="sm"
              variant={gridSize === preset ? "primary" : "ghost"}
            >
              {preset}
            </Button>
          ))}
          <Button
            onClick={() => setGridReplayNonce((nonce) => nonce + 1)}
            size="sm"
            variant="tertiary"
          >
            replay grid
          </Button>
        </div>

        <section
          className="relative grid gap-3"
          key={gridReplayNonce}
          ref={gridRef}
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${gridSize + 56}px, 1fr))`,
          }}
          {...hover.handlers}
        >
          <FluidHoverHighlight className="rounded-lg" hover={hover} />
          {BRAND_AVATAR_STATES.map((state, index) => (
            <StateCell
              gridSize={gridSize}
              index={index}
              key={state}
              onSelect={() => morphTo(state)}
              registerItem={hover.registerItem}
              selected={state === demo}
              state={state}
            />
          ))}
        </section>
      </div>
    </SurfaceProvider>
  );
};
