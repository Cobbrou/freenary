import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  deps: {
    alwaysBundle: [/@freenary\/.*/u],
  },
  dts: false,
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
  report: false,
});
