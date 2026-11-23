import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import type * as TestingLibrary from "@testing-library/react/pure";
import { JSDOM } from "jsdom";

import type * as BannerModule from "./update-banner";

class InertResizeObserver {
  private readonly observed = new Set<Element>();

  observe(element: Element) {
    this.observed.add(element);
  }

  disconnect() {
    this.observed.clear();
  }
}

const opaqueOrigin = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
});

const BROWSER_GLOBALS = {
  Element: opaqueOrigin.window.Element,
  HTMLElement: opaqueOrigin.window.HTMLElement,
  MutationObserver: opaqueOrigin.window.MutationObserver,
  Node: opaqueOrigin.window.Node,
  ResizeObserver: InertResizeObserver,
  cancelAnimationFrame: opaqueOrigin.window.cancelAnimationFrame.bind(
    opaqueOrigin.window
  ),
  document: opaqueOrigin.window.document,
  getComputedStyle: opaqueOrigin.window.getComputedStyle.bind(
    opaqueOrigin.window
  ),
  navigator: opaqueOrigin.window.navigator,
  requestAnimationFrame: opaqueOrigin.window.requestAnimationFrame.bind(
    opaqueOrigin.window
  ),
  window: opaqueOrigin.window,
};

const originals = new Map(
  Object.keys(BROWSER_GLOBALS).map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ])
);

let testingLibrary: typeof TestingLibrary;
let bannerModule: typeof BannerModule;

beforeAll(async () => {
  for (const [name, value] of Object.entries(BROWSER_GLOBALS)) {
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }

  testingLibrary = await import("@testing-library/react/pure");
  bannerModule = await import("./update-banner");
});

afterAll(() => {
  for (const [name, original] of originals) {
    if (original === undefined) {
      Reflect.deleteProperty(globalThis, name);
    } else {
      Object.defineProperty(globalThis, name, original);
    }
  }
});

describe("UpdateBanner on a page without storage", () => {
  it("still shows and dismisses when the browser blocks storage", () => {
    const { fireEvent, render } = testingLibrary;
    const { UpdateBanner } = bannerModule;

    expect(() => opaqueOrigin.window.localStorage).toThrow(
      /not available for opaque origins/u
    );

    const view = render(<UpdateBanner latest="3.0.0" />);

    expect(
      view.getByRole("region", { name: "Freenary v3.0.0 is available" })
    ).toBeDefined();

    fireEvent.click(
      view.getByRole("button", { name: "Dismiss the notice for v3.0.0" })
    );

    expect(view.queryByRole("region")).toBeNull();

    view.unmount();
  });
});
