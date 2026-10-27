import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});

const desktopMediaQuery = () => ({
  addEventListener: () => {},
  matches: false,
  removeEventListener: () => {},
});

Object.defineProperty(dom.window, "matchMedia", { value: desktopMediaQuery });

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

const railTooltipLines = async (locale: Locale | null): Promise<string[]> => {
  const { render } = await import("@testing-library/react/pure");
  const { SidebarProvider, SidebarRail } =
    await import("@freenary/ui/components/sidebar-core");

  const { UiLabelsProvider } = await import("@freenary/ui/lib/labels");
  const { overwriteGetLocale } = await import("@/paraglide/runtime.js");
  const { uiLabels } = await import("./ui-labels");

  const rail = (
    <SidebarProvider>
      <SidebarRail tooltipOpen />
    </SidebarProvider>
  );

  if (locale !== null) {
    overwriteGetLocale(() => locale);
  }

  const view = render(
    locale === null ? (
      rail
    ) : (
      <UiLabelsProvider labels={uiLabels()}>{rail}</UiLabelsProvider>
    )
  );

  const lines = [
    ...view.baseElement.querySelectorAll(
      "span[class*='text-box'] > span[style]"
    ),
  ].map(
    (verb) =>
      `**${verb.textContent}**${verb.parentElement?.textContent?.slice(verb.textContent?.length ?? 0)}`
  );

  view.unmount();

  return lines;
};

describe("sidebar rail tooltip", () => {
  it("reads in French, verbs in semibold, when the interface is French", async () => {
    expect(await railTooltipLines("fr")).toEqual([
      "**Faites glisser** pour redimensionner",
      "**Cliquez** pour masquer",
    ]);
  });

  it("reads in English when the interface is English", async () => {
    expect(await railTooltipLines("en")).toEqual([
      "**Drag** to resize",
      "**Click** to collapse",
    ]);
  });

  it("falls back to English with no labels provider", async () => {
    expect(await railTooltipLines(null)).toEqual([
      "**Drag** to resize",
      "**Click** to collapse",
    ]);
  });
});

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
