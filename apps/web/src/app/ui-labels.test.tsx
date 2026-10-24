import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});

const BROWSER_GLOBALS = {
  Element: dom.window.Element,
  HTMLElement: dom.window.HTMLElement,
  MutationObserver: dom.window.MutationObserver,
  Node: dom.window.Node,
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  document: dom.window.document,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  navigator: dom.window.navigator,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  window: dom.window,
};

beforeAll(() => {
  for (const [name, value] of Object.entries(BROWSER_GLOBALS)) {
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
});

afterAll(() => {
  for (const name of Object.keys(BROWSER_GLOBALS)) {
    Reflect.deleteProperty(globalThis, name);
  }
});

type Locale = "en" | "fr";

const closeButtonName = async (locale: Locale | null): Promise<string> => {
  const { render } = await import("@testing-library/react/pure");
  const { Dialog, DialogContent, DialogTitle } =
    await import("@freenary/ui/components/dialog");

  const { UiLabelsProvider } = await import("@freenary/ui/lib/labels");
  const { overwriteGetLocale } = await import("@/paraglide/runtime.js");
  const { uiLabels } = await import("./ui-labels");

  const dialog = (
    <Dialog open>
      <DialogContent>
        <DialogTitle>Title</DialogTitle>
      </DialogContent>
    </Dialog>
  );

  if (locale !== null) {
    overwriteGetLocale(() => locale);
  }

  const view = render(
    locale === null ? (
      dialog
    ) : (
      <UiLabelsProvider labels={uiLabels()}>{dialog}</UiLabelsProvider>
    )
  );

  const name =
    view.baseElement.querySelector(
      "[data-slot] button .sr-only, button .sr-only"
    )?.textContent ?? "";

  view.unmount();

  return name;
};

describe("dialog close button", () => {
  it("is named in French when the interface is French", async () => {
    expect(await closeButtonName("fr")).toBe("Fermer");
  });

  it("is named in English when the interface is English", async () => {
    expect(await closeButtonName("en")).toBe("Close");
  });

  it("falls back to English with no labels provider", async () => {
    expect(await closeButtonName(null)).toBe("Close");
  });
});
