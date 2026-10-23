import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ["./src/features/instance-integration/**"],
    rules: { "fsd/insignificant-slice": "off" },
  },
]);
