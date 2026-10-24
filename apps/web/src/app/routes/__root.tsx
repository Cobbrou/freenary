import { Toaster } from "@freenary/ui/components/sonner";
import { IconProvider } from "@freenary/ui/lib/icon-context";
import { UiLabelsProvider } from "@freenary/ui/lib/labels";
import { SizeProvider } from "@freenary/ui/lib/size-context";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { createMiddleware } from "@tanstack/react-start";
import { evlogErrorHandler } from "evlog/nitro/v3";
import { ThemeProvider } from "next-themes";

import { getLocale } from "@/paraglide/runtime.js";
import type { orpc } from "@/shared/api";
import { publicServerUrlScript } from "@/shared/config";
import { ffIcons } from "@/shared/lib/ff-icons";
import { isServer } from "@/shared/lib/is-server";

import { UNKNOWN_INSTANCE, getInstanceSetup } from "../api/get-instance";
import { UNKNOWN_VIEWER, getViewer } from "../api/get-viewer";
import { uiLabels } from "../ui-labels";

import appCss from "../styles/index.css?url";

export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

const RootDocument = () => (
  <html lang={getLocale()} suppressHydrationWarning>
    <head>
      <HeadContent />
    </head>
    <body>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        enableSystem
      >
        <SizeProvider defaultSize="compact">
          <IconProvider icons={ffIcons}>
            <UiLabelsProvider labels={uiLabels()}>
              <Outlet />
            </UiLabelsProvider>
          </IconProvider>
        </SizeProvider>
        <Toaster richColors />
      </ThemeProvider>
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
      <Scripts />
    </body>
  </html>
);

export const Route = createRootRouteWithContext<RouterAppContext>()({
  server: {
    middleware: [createMiddleware().server(evlogErrorHandler)],
  },

  beforeLoad: async () => ({
    instance: isServer ? await getInstanceSetup() : UNKNOWN_INSTANCE,
    viewer: isServer ? await getViewer() : UNKNOWN_VIEWER,
  }),

  head: () => {
    const serverUrlScript = publicServerUrlScript();

    return {
      meta: [
        {
          charSet: "utf-8",
        },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        {
          title: "Freenary",
        },
      ],
      links: [
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "/favicon.svg",
        },
        {
          rel: "icon",
          type: "image/png",
          href: "/favicon.png",
        },
        {
          rel: "stylesheet",
          href: appCss,
        },
      ],
      scripts: serverUrlScript ? [{ children: serverUrlScript }] : [],
    };
  },

  component: RootDocument,
});
