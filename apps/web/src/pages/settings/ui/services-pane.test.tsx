import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import type * as ReactQuery from "@tanstack/react-query";
import type * as TestingLibrary from "@testing-library/react/pure";
import { JSDOM } from "jsdom";

import type * as ServicesPaneModule from "./services-pane";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});

const BROWSER_GLOBALS = {
  Element: dom.window.Element,
  HTMLElement: dom.window.HTMLElement,
  MutationObserver: dom.window.MutationObserver,
  Node: dom.window.Node,
  document: dom.window.document,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  navigator: dom.window.navigator,
  window: dom.window,
};

const requestedUrls: string[] = [];
const firstRequest = Promise.withResolvers<string>();

const recordingServer = Bun.serve({
  fetch(request) {
    requestedUrls.push(request.url);
    firstRequest.resolve(request.url);

    return new Response(null, { status: 503 });
  },
  port: 0,
});

let reactQuery: typeof ReactQuery;
let testingLibrary: typeof TestingLibrary;
let servicesPaneModule: typeof ServicesPaneModule;

beforeAll(async () => {
  for (const [name, value] of Object.entries(BROWSER_GLOBALS)) {
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }

  dom.window.__FREENARY_SERVER_URL__ = recordingServer.url.origin;

  reactQuery = await import("@tanstack/react-query");
  testingLibrary = await import("@testing-library/react/pure");
  servicesPaneModule = await import("./services-pane");
});

afterAll(async () => {
  await recordingServer.stop(true);

  for (const name of Object.keys(BROWSER_GLOBALS)) {
    Reflect.deleteProperty(globalThis, name);
  }
});

const renderServicesPane = async () => {
  const { QueryClient, QueryClientProvider } = reactQuery;
  const { render } = testingLibrary;
  const { ServicesPane } = servicesPaneModule;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <ServicesPane />
    </QueryClientProvider>
  );

  await firstRequest.promise;

  return { requested: [...requestedUrls], view };
};

describe("ServicesPane", () => {
  it("titles the tab Services and asks for the integrations", async () => {
    const { requested, view } = await renderServicesPane();

    expect(view.queryByRole("heading", { name: "Services" })).not.toBeNull();
    expect(requested.some((key) => key.includes("instance/describe"))).toBe(
      true
    );

    view.unmount();
  });
});
