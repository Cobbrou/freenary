import evlog from "evlog/nitro/v3";
import { defineConfig } from "nitro";

const resolvedOnceAtRuntime = ["react", "react-dom"];

export default defineConfig({
  experimental: {
    asyncContext: true,
  },
  modules: [
    evlog({
      env: { service: "freenary-web" },
    }),
  ],
  traceDeps: resolvedOnceAtRuntime,
});
