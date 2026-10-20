import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

const printPublicUrl = (publicUrl: string | undefined): Plugin => ({
  configureServer(server) {
    if (publicUrl) {
      server.printUrls = () => {
        server.config.logger.info(`  ➜  Local:   ${publicUrl}/`);
      };
    }
  },
  name: "print-public-url",
});

export default defineConfig({
  server: {
    allowedHosts: true,
    port: 3000,
  },
  plugins: [
    fumadocsMdx(),
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: true,
      },
      router: {
        entry: "./app/router/router.tsx",
        routesDirectory: "app/routes",
      },
      start: {
        entry: "./app/start.ts",
      },
    }),
    react(),
    printPublicUrl(process.env.DEV_PUBLIC_URL),
    nitro({
      preset: "vercel",
    }),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      tslib: "tslib/tslib.es6.js",
    },
  },
  optimizeDeps: {
    exclude: ["shiki"],
  },
  build: {
    rolldownOptions: {
      external: [/\.wasm$/],
    },
  },
});
