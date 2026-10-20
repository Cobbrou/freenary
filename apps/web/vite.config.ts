import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
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
  plugins: [
    paraglideVitePlugin({
      cookieName: "PARAGLIDE_LOCALE",
      emitTsDeclarations: true,
      outdir: "./src/paraglide",
      outputStructure: "message-modules",
      project: "./project.inlang",
      strategy: ["cookie", "preferredLanguage", "baseLocale"],
    }),
    tailwindcss(),
    tanstackStart({
      router: {
        entry: "./app/router/router.tsx",
        routesDirectory: "app/routes",
      },
    }),
    nitro({ preset: "bun" }),
    viteReact(),
    printPublicUrl(process.env.DEV_PUBLIC_URL),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    allowedHosts: true,
    port: 3001,
  },
});
