import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { JSDOM } from "jsdom";

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

beforeAll(() => {
  for (const [name, value] of Object.entries(BROWSER_GLOBALS)) {
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
});

const originalFetch = globalThis.fetch;

afterAll(() => {
  globalThis.fetch = originalFetch;

  for (const name of Object.keys(BROWSER_GLOBALS)) {
    Reflect.deleteProperty(globalThis, name);
  }
});

const requestedUrls: string[] = [];

const recordRequest = (input: RequestInfo | URL): Promise<Response> => {
  requestedUrls.push(input instanceof Request ? input.url : String(input));

  return Promise.withResolvers<Response>().promise;
};

const renderFor = async (standing: "member" | "operator") => {
  requestedUrls.length = 0;
  globalThis.fetch = Object.assign(recordRequest, {
    preconnect: globalThis.fetch.preconnect,
  });

  const { QueryClient, QueryClientProvider } =
    await import("@tanstack/react-query");

  const { render } = await import("@testing-library/react/pure");
  const { ConnectionsPane } = await import("./connections-pane");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <ConnectionsPane standing={standing} />
    </QueryClientProvider>
  );

  await Bun.sleep(50);

  return { requested: [...requestedUrls], view };
};

describe("ConnectionsPane", () => {
  it("shows a member their bank accounts and no Services group", async () => {
    const { requested, view } = await renderFor("member");

    expect(
      view.queryByRole("heading", { name: "Bank accounts" })
    ).not.toBeNull();

    expect(view.queryByRole("heading", { name: "Services" })).toBeNull();
    expect(requested.some((key) => key.includes("instance/describe"))).toBe(
      false
    );

    view.unmount();
  });

  it("shows the operator the Services group and asks for the integrations", async () => {
    const { requested, view } = await renderFor("operator");

    expect(view.queryByRole("heading", { name: "Services" })).not.toBeNull();
    expect(requested.some((key) => key.includes("instance/describe"))).toBe(
      true
    );

    view.unmount();
  });
});
