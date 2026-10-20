import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

import { brandAvatarFrame } from "@freenary/ui/lib/brand-avatar/engine";
import { INK_STYLES, VIEW_BOX_SIZE } from "@freenary/ui/lib/brand-avatar/frame";

const INK_LIGHT = "#0a0a0a";
const INK_DARK = "#fafafa";

const SVG_SIZE = 256;
const PNG_SIZE = 32;

const CLOCKLESS_FAVICON_STATE = "logo";
const CLOCKLESS_FRAME_TIME = 0;

const frame = brandAvatarFrame(CLOCKLESS_FAVICON_STATE, CLOCKLESS_FRAME_TIME);

const sectors = frame.sectors
  .map((sector) => `    <path d="${sector.d}" fill="${sector.fill}"/>`)
  .join("\n");

const ink = frame.ink
  .flatMap((draw) => {
    if (draw.opacity <= 0) {
      return [];
    }

    const style = INK_STYLES[draw.slot];
    const rule = style.fillRule ? ` fill-rule="${style.fillRule}"` : "";
    const fill = style.fill === "currentColor" ? "var(--ink)" : style.fill;

    return [
      `  <path d="${draw.d}" fill="${fill}"${rule} opacity="${draw.opacity}"/>\n`,
    ];
  })
  .join("");

const inkStyle = ink
  ? `  <style>
    :root { --ink: ${INK_LIGHT}; }
    @media (prefers-color-scheme: dark) {
      :root { --ink: ${INK_DARK}; }
    }
  </style>
`
  : "";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}" width="${SVG_SIZE}" height="${SVG_SIZE}">
${inkStyle}  <defs>
    <clipPath id="mark" clip-rule="evenodd">
      <path d="${frame.clip}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#mark)">
${sectors}
  </g>
${ink}</svg>
`;

const publicDir = path.join(import.meta.dirname, "..", "public");
const svgPath = path.join(publicDir, "favicon.svg");

writeFileSync(svgPath, svg);

process.stdout.write(`wrote ${svgPath} (${svg.length} bytes)\n`);

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
