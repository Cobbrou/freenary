# Third-party notices

Freenary is distributed under the [GNU Affero General Public License v3.0 or later](LICENSE). It contains and depends on third-party software under its own terms. This file records the notices that must travel with a copy of Freenary. The authoritative license of each dependency is the `LICENSE` file inside its package under `node_modules`.

## Vendored source

`packages/ui/src/components` is vendored registry source: it is fetched through the registries listed in `packages/ui/components.json` and then edited in this repository. Three upstreams are reproduced below, and all are MIT, which the AGPL permits Freenary to combine with.

Most of that directory — and almost all of its volume — comes from the `@fluid` registry, which serves [Fluid Functionalism](https://github.com/mickadesign/fluid-functionalism):

```
MIT License

Copyright (c) 2026 Micka Touillaud

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The charts in `packages/ui/src/components/charts` come from the `@bklit` registry, which serves [Bklit UI](https://github.com/bklit/bklit-ui):

```
MIT License

Copyright (c) 2026 uixmat

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

`packages/ui/src/components/charts/patterns` adapts `@visx/pattern`; its notice travels beside it in `LICENSE-visx-pattern`.

The remaining components, and the `components.json` scaffolding that reaches both registries, come from the [shadcn](https://ui.shadcn.com) CLI:

```
MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Bundled dependencies

The published `ghcr.io/suiramdev/freenary-server` and `ghcr.io/suiramdev/freenary-web` images carry the **whole** install tree, not a production subset: both Dockerfiles run `bun install` with no production flag and then copy `/app` wholesale into the runner stage (`apps/web/Dockerfile:6-7,24`, `apps/server/Dockerfile:8-9,26`). Build tooling and developer tooling therefore travel with the image.

Each of those packages stays under its own license. The AGPL covers Freenary's own source; shipping separately licensed packages beside it on one image is aggregation, and every license below permits that. A census of the locked tree counts 1125 distinct packages:

| License | Count | Notes |
| --- | --- | --- |
| MIT | 950 | React, TanStack, Better Auth, Base UI, Hono, date-fns and most of the rest |
| Apache-2.0 | 64 | Prisma and its engines, and others |
| ISC | 55 | Build and runtime utilities |
| BSD-3-Clause, BSD-2-Clause, 0BSD | 30 | Build and runtime utilities |
| Unlicense, MIT-0, CC0-1.0, `MIT OR CC0-1.0` | 8 | Public-domain-equivalent utilities |
| MPL-2.0 | 4 | `lightningcss` and its platform binaries, build only |
| BlueOak-1.0.0 | 3 | `npm` ecosystem utilities |
| `MIT AND ISC` | 1 | `@visx/vendor`, a bundled d3 fork under `@visx/shape` |
| `AFL-2.1 OR BSD-3-Clause` | 1 | `json-schema`, through the AI SDK; Freenary takes it under BSD-3-Clause |
| CC-BY-4.0 | 1 | `caniuse-lite`, the browser-support data behind `browserslist`, build only |
| WTFPL | 1 | `prexit`, through `steiger`, the architecture linter, developer tooling only |
| Python-2.0 | 1 | `argparse`, through `js-yaml`, through the `shadcn` CLI |
| EPL-2.0 | 1 | `elkjs`, a graph-layout library inside `@prisma/studio-core`, reached from the `prisma` CLI |
| Remix Icon License 1.0 (Apache-2.0) | 1 | `@remixicon/react` |
| OFL-1.1 | 1 | Allo by Josh Puckett, vendored in `packages/ui/src/styles/fonts` with roundness fixed at 100 |

No package in the tree is under the GPL, the AGPL or the SSPL.

Two license terms need a word:

- **EPL-2.0.** The FSF holds it incompatible with the GPL family, so `elkjs` must never be linked into Freenary's own code. It reaches the tree only through the `prisma` CLI, which is a `devDependencies` entry of `packages/db` and is developer tooling: Prisma Studio, not the served application. The image carries it beside Freenary rather than as part of it.
- **CC-BY-4.0.** `caniuse-lite` is a data set consumed at build time. It never reaches the runtime bundles.

Two packages in the locked tree declare no `license` field: `seq-queue` (through `mysql2`, through the `prisma` CLI) and `@lix-js/sdk-darwin-arm64` (an optional macOS-arm64 binary of the Paraglide toolchain, absent from a Linux image).

To regenerate the census, read the `license` field of every installed package. Bun uses an isolated linker here, so the packages live under `node_modules/.bun/` and a top-level `node_modules/*` glob finds only the eleven workspace links. The store also keeps directories from earlier installs, so the census must intersect it with `bun.lock`: a plain glob over the store counts packages the tree no longer holds.

```bash
bun -e '
const lock = await Bun.file("bun.lock").text();
const pattern = /^\s+"[^"]+": \["((?:@[^\/"]+\/)?[^@"]+@[^"]+)"/gm;
const locked = new Set([...lock.matchAll(pattern)].map((match) => match[1]));
const globs = [
  "node_modules/.bun/*/node_modules/*/package.json",
  "node_modules/.bun/*/node_modules/@*/*/package.json",
];
const licenses = new Map();
for (const glob of globs) {
  for (const file of new Bun.Glob(glob).scanSync(".")) {
    const pkg = await Bun.file(file).json().catch(() => null);
    if (!pkg?.name) continue;
    const id = pkg.name + "@" + pkg.version;
    if (locked.has(id)) licenses.set(id, pkg.license ?? "no license field");
  }
}
const counts = new Map();
for (const license of licenses.values()) {
  counts.set(license, (counts.get(license) ?? 0) + 1);
}
const rows = [...counts].sort((a, b) => b[1] - a[1]);
for (const [license, count] of rows) console.log(String(count).padStart(5), license);
'
```
