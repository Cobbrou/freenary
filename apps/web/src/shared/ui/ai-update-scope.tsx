import { accentPair } from "glimm";
import { GlimmScope } from "glimm/react";
import type { GlimmScopeHandle } from "glimm/react";
import type { ReactNode, Ref } from "react";

export type AiUpdateScopeHandle = GlimmScopeHandle;

interface AiUpdateScopeProps {
  children: ReactNode;
  ref: Ref<GlimmScopeHandle>;
  size?: "region" | "element";
}

const PIGGY_PINK = "#ff6fa5";

const COIN_GOLD = "#ffc23d";

const AI_PALETTE = accentPair(PIGGY_PINK, COIN_GOLD);

const REGION = { bandTight: 28, curve: 0.12, sweepMs: 1500 } as const;

const ELEMENT = { bandTight: 34, curve: 0.06, sweepMs: 1100 } as const;

export const AiUpdateScope = ({
  children,
  ref,
  size = "region",
}: AiUpdateScopeProps) => (
  <GlimmScope
    {...(size === "region" ? REGION : ELEMENT)}
    direction="ttb"
    pageEffect={false}
    palette={AI_PALETTE}
    ref={ref}
  >
    {children}
  </GlimmScope>
);
