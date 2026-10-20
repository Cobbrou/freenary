import { defineConfig } from "oxlint";
import { oxslop } from "oxslop/config";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";

export default defineConfig({
  extends: [
    core,
    react,
    tanstack,
    oxslop({
      rules: {
        "no-comments": ["error", { allowJsdoc: false }],
        "no-reexport-only-modules": ["error", { allowFiles: ["index.ts"] }],
      },
      strict: true,
    }),
  ],
  ignorePatterns: [
    ...core.ignorePatterns,
    ".claude/**",
    ".cursor/**",
    ".agent/**",
    ".agents/**",
    ".codex/**",
    ".continue/**",
    ".gemini/**",
    ".opencode/**",
    ".pi/**",
    ".roo/**",
    ".windsurf/**",
    "packages/ui/**",
    "apps/web/src/paraglide/**",
  ],
  jsPlugins: ["@shadcn/lint"],
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx"],
      rules: {
        "oxslop/require-safety-comment-for-type-assertion": "off",
      },
    },
  ],
  plugins: [
    "eslint",
    "typescript",
    "unicorn",
    "oxc",
    "import",
    "jsdoc",
    "node",
    "promise",
    "react",
    "react-perf",
    "jsx-a11y",
  ],
  settings: {
    shadcn: {
      componentImports: ["^@/shared/ui(/|$)"],
    },
  },
});
