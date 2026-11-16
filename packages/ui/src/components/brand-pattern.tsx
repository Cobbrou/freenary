import { brandAvatarFrame } from "@freenary/ui/lib/brand-avatar/engine";
import { MARK_COLOR, VIEW_BOX_SIZE } from "@freenary/ui/lib/brand-avatar/frame";
import { cn } from "@freenary/ui/lib/utils";
import * as React from "react";

/**
 * The mark, repeated across a surface. For a place that is about the brand
 * rather than about data — a sign-in panel, an empty stage. Purely decorative,
 * so it is hidden from assistive technology and takes no pointer events.
 *
 * It tiles the very frame the favicon draws — the piggy bank head with its
 * coin slot — so retuning the mark retunes this. The fills are
 * the brand's own and do not follow the theme; a caller sets how much of them
 * shows with an `opacity-*` class.
 */

/** `logo` has no clock in it, which is what lets one frame be drawn once. */
const MARK = brandAvatarFrame("logo", 0);
/** Square to the viewer, the two faces coincide, so the slot is a plain hole. */
const MARK_PATH = MARK.front + MARK.slot;

/** Two marks per tile, on the diagonal, so rows fall out of step. */
const TILE_UNITS = VIEW_BOX_SIZE * 2;
const OFFSET = VIEW_BOX_SIZE;
/** Each mark's rendered size, as a share of its cell. */
const MARK_SCALE = 0.42;
const CENTER = VIEW_BOX_SIZE / 2;

/** Scales a mark about its own centre, then moves it to a cell. */
const cell = (x: number, y: number): string =>
  `translate(${x + CENTER} ${y + CENTER}) scale(${MARK_SCALE}) translate(${-CENTER} ${-CENTER})`;

type BrandPatternProps = Omit<React.ComponentProps<"svg">, "children"> & {
  /** Rendered edge length of one tile in pixels. */
  tile?: number;
};

function BrandPattern({ className, tile = 160, ...props }: BrandPatternProps) {
  const tileId = `${React.useId()}tile`;

  const mark = <path d={MARK_PATH} fill={MARK_COLOR} fillRule="evenodd" />;

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 size-full select-none",
        className
      )}
      data-slot="brand-pattern"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <pattern
          height={tile}
          id={tileId}
          patternUnits="userSpaceOnUse"
          viewBox={`0 0 ${TILE_UNITS} ${TILE_UNITS}`}
          width={tile}
        >
          <g transform={cell(0, 0)}>{mark}</g>
          <g transform={cell(OFFSET, OFFSET)}>{mark}</g>
        </pattern>
      </defs>
      <rect fill={`url(#${tileId})`} height="100%" width="100%" />
    </svg>
  );
}

export { BrandPattern, type BrandPatternProps };
