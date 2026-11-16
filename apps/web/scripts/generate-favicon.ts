import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

import { brandAvatarFrame } from "@freenary/ui/lib/brand-avatar/engine";
import { MARK_COLOR, VIEW_BOX_SIZE } from "@freenary/ui/lib/brand-avatar/frame";

const SVG_SIZE = 256;
const PNG_SIZE = 32;

const CLOCKLESS_FAVICON_STATE = "logo";
const CLOCKLESS_FRAME_TIME = 0;

const frame = brandAvatarFrame(CLOCKLESS_FAVICON_STATE, CLOCKLESS_FRAME_TIME);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}" width="${SVG_SIZE}" height="${SVG_SIZE}">
  <path d="${frame.front}${frame.slot}" fill="${MARK_COLOR}" fill-rule="evenodd"/>
</svg>
`;

const publicDir = path.join(import.meta.dirname, "..", "public");
const svgPath = path.join(publicDir, "favicon.svg");

const dokployLogoPath = path.join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "deploy",
  "dokploy",
  "freenary.svg"
);

for (const target of [svgPath, dokployLogoPath]) {
  writeFileSync(target, svg);
  process.stdout.write(`wrote ${target} (${svg.length} bytes)\n`);
}

const pngPath = path.join(publicDir, "favicon.png");

const rasterizers = [
  [
    "rsvg-convert",
    ["-w", `${PNG_SIZE}`, "-h", `${PNG_SIZE}`, "-o", pngPath, svgPath],
  ],
  ["resvg", ["-w", `${PNG_SIZE}`, "-h", `${PNG_SIZE}`, svgPath, pngPath]],
] as const;

for (const [command, args] of rasterizers) {
  const rasterized = spawnSync(command, args, { stdio: "inherit" });

  if (rasterized.status === 0) {
    process.stdout.write(`wrote ${pngPath} at ${PNG_SIZE}px\n`);
    process.exit(0);
  }
}

process.stdout.write(
  `no rasterizer on PATH; ${pngPath} left as it was. Install rsvg-convert (librsvg) or resvg and re-run to refresh it.\n`
);
