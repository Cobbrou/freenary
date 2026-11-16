import {
  type Attention,
  attentionGaze,
  pointerOffset,
  RESTING_ATTENTION,
  stepAttention,
} from "@freenary/ui/lib/brand-avatar/attention";
import {
  type BrandAvatarEngine,
  brandAvatarFrame,
  createBrandAvatarEngine,
} from "@freenary/ui/lib/brand-avatar/engine";
import {
  type AvatarFrame,
  COIN_COLOR,
  COIN_MARK_COLOR,
  type CoinDraw,
  EYE_INK,
  EYE_STROKE_WIDTH,
  EYE_STYLES,
  MARK_COLOR,
  SHINE_COLOR,
  SPARK_COLOR,
  VIEW_BOX_SIZE,
} from "@freenary/ui/lib/brand-avatar/frame";
import { seedOf } from "@freenary/ui/lib/brand-avatar/math";
import type { BrandAvatarState } from "@freenary/ui/lib/brand-avatar/states";
import { cn } from "@freenary/ui/lib/utils";
import * as React from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const watchReducedMotion = (onChange: () => void): (() => void) => {
  const media = window.matchMedia(REDUCED_MOTION);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

/**
 * The Freenary piggy bank, as the logo and as the agent. `state="logo"` draws
 * the static mark — the pink squircle head with its coin slot — and every
 * other state is the agent: the same head with Open Bot Avatar's eyes, an ink
 * snout and motion, turning toward the pointer, with gold coins and glints for
 * its money moments.
 *
 * The avatar animates by patching `d` and `opacity` on a fixed set of paths
 * rather than by re-rendering: the shape list never changes, and a gallery of
 * these must not cost a React commit per frame per instance.
 */

/** The mask region: wide enough for every hop, tilt and turn. */
const MASK_MARGIN = 40;

type NodeMap = Record<string, SVGPathElement | null>;

const write = (
  node: SVGPathElement | null | undefined,
  attribute: string,
  value: string
): void => {
  if (node && node.getAttribute(attribute) !== value) {
    node.setAttribute(attribute, value);
  }
};

const opacityValue = (opacity: number): string =>
  (Math.round(opacity * 1000) / 1000).toString();

/**
 * Open coins and glints are slotted by their index in the frame, which holds
 * exactly as many as the pose carries: `OPEN_COINS` and the glint spots in
 * `pose.ts`.
 */
const coinSlot = (index: number): string => `coin-${index}`;
const sparkSlot = (index: number): string => `spark-${index}`;

const writeCoin = (nodes: NodeMap, slot: string, coin: CoinDraw): void => {
  const opacity = opacityValue(coin.opacity);
  write(nodes[`${slot}-disc`], "d", coin.disc);
  write(nodes[`${slot}-disc`], "opacity", opacity);
  write(nodes[`${slot}-ring`], "d", coin.ring);
  write(nodes[`${slot}-ring`], "opacity", opacity);
};

const applyFrame = (nodes: NodeMap, frame: AvatarFrame): void => {
  write(nodes.body, "d", frame.body);
  write(nodes.slot, "d", frame.slot);
  write(nodes["shine-clip"], "d", frame.front);
  write(nodes.shine, "d", frame.shine.d);
  write(nodes.shine, "opacity", opacityValue(frame.shine.opacity));
  write(nodes.nose, "d", frame.nose.d);
  write(nodes.nose, "opacity", opacityValue(frame.nose.opacity));
  write(nodes["coin-clip"], "d", frame.coinClip);
  writeCoin(nodes, "drop", frame.drop);
  frame.coins.forEach((coin, index) => {
    writeCoin(nodes, coinSlot(index), coin);
  });
  frame.sparks.forEach((spark, index) => {
    const slot = sparkSlot(index);
    write(nodes[slot], "d", spark.d);
    write(nodes[slot], "opacity", opacityValue(spark.opacity));
  });
  for (const eye of frame.eyes) {
    write(nodes[eye.slot], "d", eye.d);
    write(nodes[eye.slot], "opacity", opacityValue(eye.opacity));
  }
};

type BrandAvatarProps = Omit<React.ComponentProps<"svg">, "children"> & {
  /** Which expression to hold. Defaults to the living rest state. */
  state?: BrandAvatarState;
  /** Rendered edge length in pixels. */
  size?: number;
  /**
   * Accessible name. Without one the avatar is decorative and hidden from
   * assistive technology — which is right when it sits inside a link or a
   * button that already names itself.
   */
  label?: string;
  /**
   * Draw one still frame of the state — its steady pose, with no blink, glance
   * or sway caught mid-way — and run no animation loop. Reduced motion draws
   * the same frame. What a thumbnail or a past message wants.
   */
  frozen?: boolean;
};

function BrandAvatar({
  className,
  frozen: frozenProp = false,
  label,
  size = 40,
  state = "idle",
  ...props
}: BrandAvatarProps) {
  const id = React.useId();
  const maskId = `${id}slot`;
  const shineClipId = `${id}shine`;
  const coinClipId = `${id}coin`;
  // `useId` is the same on the server and the client, so the seeded first
  // frame hydrates without a mismatch, and every avatar blinks on its own beat.
  const seed = seedOf(id);
  // `false` on the server, so the markup rendered there matches the first
  // client render and the real preference lands on hydration.
  const reducedMotion = React.useSyncExternalStore(
    watchReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false
  );
  const frozen = frozenProp || reducedMotion;

  const svg = React.useRef<SVGSVGElement>(null);
  const nodes = React.useRef<NodeMap>({});
  const engine = React.useRef<BrandAvatarEngine | null>(null);
  const origin = React.useRef(0);
  const pending = React.useRef(state);

  // The animated path attributes are written imperatively, so the rendered
  // markup only has to be right for the very first paint (and for every paint
  // when the avatar is frozen).
  const [mounted] = React.useState<AvatarFrame>(() =>
    brandAvatarFrame(state, 0, seed)
  );
  const frame = frozen ? brandAvatarFrame(state, 0, seed, true) : mounted;

  React.useEffect(() => {
    pending.current = state;
    engine.current?.setState(
      state,
      (performance.now() - origin.current) / 1000
    );
  }, [state]);

  React.useEffect(() => {
    if (frozen) {
      return;
    }
    origin.current = performance.now();
    const running = createBrandAvatarEngine(pending.current, 0, seed);
    engine.current = running;

    let pointer: { x: number; y: number } | null = null;
    const onMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
    };
    const onLeave = (event: PointerEvent) => {
      if (event.relatedTarget === null) {
        pointer = null;
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onLeave);

    let attention: Attention = RESTING_ATTENTION;
    let last = origin.current;
    let request = 0;
    const tick = (now: number) => {
      const box = svg.current?.getBoundingClientRect();
      const target = pointer && box ? pointerOffset(pointer, box) : null;
      attention = stepAttention(attention, target, (now - last) / 1000);
      last = now;
      applyFrame(
        nodes.current,
        running.sample((now - origin.current) / 1000, attentionGaze(attention))
      );
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(request);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onLeave);
      engine.current = null;
    };
    // The loop must outlive a state change: the engine blends into the new
    // state instead of being rebuilt on it.
  }, [frozen, seed]);

  React.useEffect(() => {
    if (!frozen) {
      return;
    }
    // React only writes props it believes changed, and it believes every path
    // still holds the frame captured at mount — so a frame the loop wrote
    // imperatively would otherwise survive the loop being cancelled.
    applyFrame(nodes.current, frame);
  }, [frame, frozen]);

  const register = (slot: string) => (node: SVGPathElement | null) => {
    nodes.current[slot] = node;
  };

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("block shrink-0 overflow-visible", className)}
      data-slot="brand-avatar"
      data-state={state}
      height={size}
      ref={svg}
      role={label ? "img" : undefined}
      viewBox={`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`}
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <mask
          height={VIEW_BOX_SIZE + MASK_MARGIN * 2}
          id={maskId}
          maskUnits="userSpaceOnUse"
          width={VIEW_BOX_SIZE + MASK_MARGIN * 2}
          x={-MASK_MARGIN}
          y={-MASK_MARGIN}
        >
          <rect
            fill="#fff"
            height={VIEW_BOX_SIZE + MASK_MARGIN * 2}
            width={VIEW_BOX_SIZE + MASK_MARGIN * 2}
            x={-MASK_MARGIN}
            y={-MASK_MARGIN}
          />
          <path d={frame.slot} fill="#000" ref={register("slot")} />
        </mask>
        <clipPath id={shineClipId}>
          <path d={frame.front} ref={register("shine-clip")} />
        </clipPath>
        <clipPath id={coinClipId}>
          <path d={frame.coinClip} ref={register("coin-clip")} />
        </clipPath>
      </defs>
      <path
        d={frame.body}
        fill={MARK_COLOR}
        mask={`url(#${maskId})`}
        ref={register("body")}
      />
      <path
        clipPath={`url(#${shineClipId})`}
        d={frame.shine.d}
        fill={SHINE_COLOR}
        mask={`url(#${maskId})`}
        opacity={frame.shine.opacity}
        ref={register("shine")}
      />
      <path
        d={frame.nose.d}
        fill={EYE_INK}
        fillRule="evenodd"
        opacity={frame.nose.opacity}
        ref={register("nose")}
      />
      {frame.eyes.map((eye) =>
        EYE_STYLES[eye.slot] === "fill" ? (
          <path
            d={eye.d}
            fill={EYE_INK}
            key={eye.slot}
            opacity={eye.opacity}
            ref={register(eye.slot)}
          />
        ) : (
          <path
            d={eye.d}
            fill="none"
            key={eye.slot}
            opacity={eye.opacity}
            ref={register(eye.slot)}
            stroke={EYE_INK}
            strokeLinecap="round"
            strokeWidth={EYE_STROKE_WIDTH}
          />
        )
      )}
      <g clipPath={`url(#${coinClipId})`}>
        <CoinPaths coin={frame.drop} register={register} slot="drop" />
      </g>
      {frame.coins.map((coin, index) => {
        const slot = coinSlot(index);
        return (
          <CoinPaths coin={coin} key={slot} register={register} slot={slot} />
        );
      })}
      {frame.sparks.map((spark, index) => {
        const slot = sparkSlot(index);
        return (
          <path
            d={spark.d}
            fill={SPARK_COLOR}
            key={slot}
            opacity={spark.opacity}
            ref={register(slot)}
          />
        );
      })}
    </svg>
  );
}

function CoinPaths({
  coin,
  register,
  slot,
}: {
  coin: CoinDraw;
  register: (slot: string) => (node: SVGPathElement | null) => void;
  slot: string;
}) {
  return (
    <>
      <path
        d={coin.disc}
        fill={COIN_COLOR}
        opacity={coin.opacity}
        ref={register(`${slot}-disc`)}
      />
      <path
        d={coin.ring}
        fill={COIN_MARK_COLOR}
        fillRule="evenodd"
        opacity={coin.opacity}
        ref={register(`${slot}-ring`)}
      />
    </>
  );
}

export { BrandAvatar, type BrandAvatarProps };
