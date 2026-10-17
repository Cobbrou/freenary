import { gitConfig, repoBlobUrl, repoRawUrl } from "../src/shared/config/site";

export type ReleasePin = {
  readonly folder: string;
  readonly tag: string;
};

export type MovingRef = {
  readonly message: (folder: string) => string;
  readonly moving: string;
  readonly pinned: (pin: ReleasePin) => string;
  readonly rule: "link" | "version";
};

export const MOVING_REFS: readonly MovingRef[] = [
  {
    message: (folder) =>
      `a repository link names \`${gitConfig.branch}\`. A released page pins it: \`/blob/v${folder}.0/\`, or whichever patch tag holds the code the page describes.`,
    moving: `](${repoBlobUrl(gitConfig.branch)}`,
    pinned: ({ tag }) => `](${repoBlobUrl(tag)}`,
    rule: "link",
  },
  {
    message: (folder) =>
      `a download URL names \`${gitConfig.branch}\`, so the reader gets a file that moved past this release. A released page pins it: \`/v${folder}.0/\`, or whichever patch tag holds the files the page describes.`,
    moving: repoRawUrl(gitConfig.branch),
    pinned: ({ tag }) => repoRawUrl(tag),
    rule: "link",
  },
  {
    message: () =>
      `a deploy step names the branch \`${gitConfig.branch}\`, which holds unreleased files. A released page deploys \`${gitConfig.releaseBranch}\`.`,
    moving: `Branch: \`${gitConfig.branch}\``,
    pinned: () => `Branch: \`${gitConfig.releaseBranch}\``,
    rule: "link",
  },
  {
    message: (folder) =>
      `\`FREENARY_VERSION=${gitConfig.branch}\` names the moving branch. A released page pins it: \`FREENARY_VERSION=${folder}\`.`,
    moving: `\nFREENARY_VERSION=${gitConfig.branch}\n`,
    pinned: ({ folder }) => `\nFREENARY_VERSION=${folder}\n`,
    rule: "version",
  },
];

export const pinMovingRefs = (raw: string, pin: ReleasePin) => {
  let pinned = raw;

  for (const ref of MOVING_REFS) {
    pinned = pinned.replaceAll(ref.moving, ref.pinned(pin));
  }

  return pinned;
};

export const indexOfMatchedText = (ref: MovingRef, index: number) =>
  ref.moving.startsWith("\n") ? index + 1 : index;
