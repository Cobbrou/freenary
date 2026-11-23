import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import type * as DialogModule from "@freenary/ui/components/dialog";
import type * as SidebarModule from "@freenary/ui/components/sidebar-core";
import type * as LabelsModule from "@freenary/ui/lib/labels";
import type * as TestingLibrary from "@testing-library/react/pure";
import { JSDOM } from "jsdom";

import type * as RuntimeModule from "@/paraglide/runtime.js";

import type * as UiLabelsModule from "./ui-labels";

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

let testingLibrary: typeof TestingLibrary;
let dialogModule: typeof DialogModule;
let sidebarModule: typeof SidebarModule;
let labelsModule: typeof LabelsModule;
let runtimeModule: typeof RuntimeModule;
let uiLabelsModule: typeof UiLabelsModule;

beforeAll(async () => {
  for (const [name, value] of Object.entries(BROWSER_GLOBALS)) {
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }

  testingLibrary = await import("@testing-library/react/pure");
  dialogModule = await import("@freenary/ui/components/dialog");
  sidebarModule = await import("@freenary/ui/components/sidebar-core");
  labelsModule = await import("@freenary/ui/lib/labels");
  runtimeModule = await import("@/paraglide/runtime.js");
  uiLabelsModule = await import("./ui-labels");
});

afterAll(() => {
  for (const name of Object.keys(BROWSER_GLOBALS)) {
    Reflect.deleteProperty(globalThis, name);
  }
});

type Locale = "en" | "fr";

const closeButtonName = (locale: Locale | null): string => {
  const { render } = testingLibrary;
  const { Dialog, DialogContent, DialogTitle } = dialogModule;
  const { UiLabelsProvider } = labelsModule;
  const { overwriteGetLocale } = runtimeModule;
  const { uiLabels } = uiLabelsModule;

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

const railTooltipLines = (locale: Locale | null): string[] => {
  const { render } = testingLibrary;
  const { SidebarProvider, SidebarRail } = sidebarModule;
  const { UiLabelsProvider } = labelsModule;
  const { overwriteGetLocale } = runtimeModule;
  const { uiLabels } = uiLabelsModule;

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
  it("reads in French, verbs in semibold, when the interface is French", () => {
    expect(railTooltipLines("fr")).toEqual([
      "**Faites glisser** pour redimensionner",
      "**Cliquez** pour masquer",
    ]);
  });

  it("reads in English when the interface is English", () => {
    expect(railTooltipLines("en")).toEqual([
      "**Drag** to resize",
      "**Click** to collapse",
    ]);
  });

  it("falls back to English with no labels provider", () => {
    expect(railTooltipLines(null)).toEqual([
      "**Drag** to resize",
      "**Click** to collapse",
    ]);
  });
});

describe("dialog close button", () => {
  it("is named in French when the interface is French", () => {
    expect(closeButtonName("fr")).toBe("Fermer");
  });

  it("is named in English when the interface is English", () => {
    expect(closeButtonName("en")).toBe("Close");
  });

  it("falls back to English with no labels provider", () => {
    expect(closeButtonName(null)).toBe("Close");
  });
});
