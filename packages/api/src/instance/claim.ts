import { createHash, timingSafeEqual } from "node:crypto";

import type { SetupState } from "@freenary/instance-config";

const TOKEN_DIGEST = "sha256";

const digestOf = (value: string): Buffer =>
  createHash(TOKEN_DIGEST).update(value).digest();

export const admitsClaim = (
  expectedToken: string | undefined,
  candidate: string
): boolean =>
  expectedToken === undefined ||
  timingSafeEqual(digestOf(candidate.trim()), digestOf(expectedToken));

export interface SetupViewer {
  readonly isOperator: boolean;
}

export interface VisibleSetupStatus {
  readonly claimed: boolean | null;
  readonly completed: boolean;
  readonly isOperator: boolean;
  readonly setupTokenRequired: boolean | null;
}

export const visibleSetupStatus = (
  { claimed, completed }: SetupState,
  viewer: SetupViewer | null,
  setupTokenRequired: boolean
): VisibleSetupStatus =>
  viewer === null
    ? { claimed: null, completed, isOperator: false, setupTokenRequired: null }
    : { claimed, completed, isOperator: viewer.isOperator, setupTokenRequired };
