import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import type * as TestingLibrary from "@testing-library/react/pure";
import { JSDOM } from "jsdom";

import type * as BannerModule from "./update-banner";

const resizes = new Set<() => void>();

class RecordingResizeObserver {
  private readonly onResize: () => void;

  constructor(onResize: () => void) {
    this.onResize = onResize;
  }

  observe() {
    resizes.add(this.onResize);
  }

  disconnect() {
    resizes.delete(this.onResize);
  }
}

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});

const BROWSER_GLOBALS = {
  Element: dom.window.Element,
  HTMLElement: dom.window.HTMLElement,
  MutationObserver: dom.window.MutationObserver,
  Node: dom.window.Node,
  ResizeObserver: RecordingResizeObserver,
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  document: dom.window.document,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  localStorage: dom.window.localStorage,
  navigator: dom.window.navigator,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  window: dom.window,
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

const renderBanner = (latest: string | null) => {
  const { render } = testingLibrary;
  const { UpdateBanner } = bannerModule;

  return render(<UpdateBanner latest={latest} />);
};

describe("UpdateBanner", () => {
  it("names the release in a region with new-tab links and a dismiss button", () => {
    localStorage.clear();
    const view = renderBanner("1.3.0");

    const region = view.getByRole("region", {
      name: "Freenary v1.3.0 is available",
    });

    const links = [...region.querySelectorAll("a")].map((link) => ({
      href: link.getAttribute("href"),
      name: link.textContent,
      target: link.getAttribute("target"),
    }));

    expect(links).toEqual([
      {
        href: "https://github.com/suiramdev/freenary/releases/tag/v1.3.0",
        name: "Release notes(opens in a new tab)",
        target: "_blank",
      },
      {
        href: "https://freenary.dev/docs/how-to/update-freenary",
        name: "How to update(opens in a new tab)",
        target: "_blank",
      },
    ]);

    expect(
      view.getByRole("button", { name: "Dismiss the notice for v1.3.0" })
    ).toBeDefined();

    expect(region.getAttribute("role")).toBeNull();

    view.unmount();
  });

  it("shows nothing to a member or without a newer release", () => {
    localStorage.clear();
    const view = renderBanner(null);

    expect(view.queryByRole("region")).toBeNull();

    view.unmount();
  });

  it("stays dismissed for that release, and returns for a newer one", () => {
    localStorage.clear();
    const { fireEvent } = testingLibrary;
    const first = renderBanner("1.3.0");

    fireEvent.click(
      first.getByRole("button", { name: "Dismiss the notice for v1.3.0" })
    );

    expect(first.queryByRole("region")).toBeNull();
    expect(localStorage.getItem("freenary.update.dismissed")).toBe("1.3.0");

    first.unmount();

    const reloaded = renderBanner("1.3.0");

    expect(reloaded.queryByRole("region")).toBeNull();

    reloaded.unmount();

    const newer = renderBanner("1.4.0");

    expect(
      newer.getByRole("region", { name: "Freenary v1.4.0 is available" })
    ).toBeDefined();

    newer.unmount();
  });

  it("moves focus past the banner when it is dismissed", () => {
    localStorage.clear();
    const { fireEvent, render } = testingLibrary;
    const { UpdateBanner } = bannerModule;
    const view = render(
      <div>
        <UpdateBanner latest="2.0.0" />
        <div>
          <nav>
            <button type="button">Sidebar row</button>
          </nav>
          <main>
            <header>
              <button type="button">Toggle sidebar</button>
            </header>
          </main>
        </div>
      </div>
    );

    fireEvent.click(
      view.getByRole("button", { name: "Dismiss the notice for v2.0.0" })
    );

    expect(document.activeElement?.textContent).toBe("Toggle sidebar");

    view.unmount();
  });

  it("publishes its height for the shell, and clears it once dismissed", () => {
    localStorage.clear();

    const { fireEvent } = testingLibrary;
    const view = renderBanner("2.1.0");
    const root = document.documentElement;

    expect(root.style.getPropertyValue("--update-banner-height")).toBe("0px");

    root.style.removeProperty("--update-banner-height");

    for (const resize of resizes) {
      resize();
    }

    expect(root.style.getPropertyValue("--update-banner-height")).toBe("0px");

    fireEvent.click(
      view.getByRole("button", { name: "Dismiss the notice for v2.1.0" })
    );

    expect(root.style.getPropertyValue("--update-banner-height")).toBe("");

    view.unmount();
  });
});
