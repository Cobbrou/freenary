import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { JSDOM } from "jsdom";

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

beforeAll(() => {
  for (const [name, value] of Object.entries(BROWSER_GLOBALS)) {
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
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

const throwingStorage = {
  clear: () => {},
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

const renderBanner = async (latest: string | null) => {
  const { render } = await import("@testing-library/react/pure");
  const { UpdateBanner } = await import("./update-banner");

  return render(<UpdateBanner latest={latest} />);
};

describe("UpdateBanner", () => {
  it("names the release in a region with new-tab links and a dismiss button", async () => {
    localStorage.clear();
    const view = await renderBanner("1.3.0");

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
        href: "https://freenary.dev/docs/1.3/run/updates-and-backups",
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

  it("shows nothing to a member or without a newer release", async () => {
    localStorage.clear();
    const view = await renderBanner(null);

    expect(view.queryByRole("region")).toBeNull();

    view.unmount();
  });

  it("stays dismissed for that release, and returns for a newer one", async () => {
    localStorage.clear();
    const { fireEvent } = await import("@testing-library/react/pure");
    const first = await renderBanner("1.3.0");

    fireEvent.click(
      first.getByRole("button", { name: "Dismiss the notice for v1.3.0" })
    );

    expect(first.queryByRole("region")).toBeNull();
    expect(localStorage.getItem("freenary.update.dismissed")).toBe("1.3.0");

    first.unmount();

    const reloaded = await renderBanner("1.3.0");

    expect(reloaded.queryByRole("region")).toBeNull();

    reloaded.unmount();

    const newer = await renderBanner("1.4.0");

    expect(
      newer.getByRole("region", { name: "Freenary v1.4.0 is available" })
    ).toBeDefined();

    newer.unmount();
  });

  it("moves focus past the banner when it is dismissed", async () => {
    localStorage.clear();
    const { fireEvent, render } = await import("@testing-library/react/pure");
    const { UpdateBanner } = await import("./update-banner");
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

  it("publishes its height for the shell, and clears it once dismissed", async () => {
    localStorage.clear();

    const { fireEvent } = await import("@testing-library/react/pure");
    const view = await renderBanner("2.1.0");
    const root = document.documentElement;
    const revealWrapper = view.getByRole("region").parentElement?.parentElement;

    expect(root.style.getPropertyValue("--update-banner-height")).toBe("0px");

    Object.defineProperty(revealWrapper, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ height: 44 }),
    });

    for (const resize of resizes) {
      resize();
    }

    expect(root.style.getPropertyValue("--update-banner-height")).toBe("44px");

    fireEvent.click(
      view.getByRole("button", { name: "Dismiss the notice for v2.1.0" })
    );

    expect(root.style.getPropertyValue("--update-banner-height")).toBe("");

    view.unmount();
  });

  it("still shows and dismisses when the browser blocks storage", async () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: throwingStorage,
    });

    const { fireEvent } = await import("@testing-library/react/pure");
    const view = await renderBanner("3.0.0");

    fireEvent.click(
      view.getByRole("button", { name: "Dismiss the notice for v3.0.0" })
    );

    expect(view.queryByRole("region")).toBeNull();

    view.unmount();

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: dom.window.localStorage,
    });
  });
});
