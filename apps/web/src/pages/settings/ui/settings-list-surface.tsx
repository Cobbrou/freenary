import { Elevated } from "@freenary/ui/lib/elevated";
import type * as React from "react";

const SURFACE_RADIUS = "rounded-xl";
const SURFACE_STEP = 1;

const TOUCH_TARGETS =
  "pointer-coarse:[&_button]:min-h-11 pointer-coarse:[&_button]:min-w-11";

export const SettingsListSurface = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <Elevated className={SURFACE_RADIUS} offset={SURFACE_STEP}>
    <div className={TOUCH_TARGETS}>{children}</div>
  </Elevated>
);
