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

Object.defineProperty(dom.window.Element.prototype, "getAnimations", {
  value: () => [],
});

const BROWSER_GLOBALS = {
  AbortController: dom.window.AbortController,
  AbortSignal: dom.window.AbortSignal,
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

describe("update rows in the account menu", () => {
  it("are a group named by the version heading", async () => {
    const { render } = await import("@testing-library/react/pure");
    const {
      DropdownContent,
      DropdownGroup,
      DropdownGroupLabel,
      DropdownMenu,
      DropdownTrigger,
    } = await import("@freenary/ui/components/dropdown");

    const { MenuItem } = await import("@freenary/ui/components/menu-item");
    const { RiExternalLinkLine } = await import("@remixicon/react");
    const { remixIcon } = await import("@/shared/lib/remix-icon");
    const External = remixIcon(RiExternalLinkLine);

    const view = render(
      <DropdownMenu defaultOpen>
        <DropdownTrigger>Account</DropdownTrigger>
        <DropdownContent>
          <DropdownGroup>
            <DropdownGroupLabel>Update available: v1.3.0</DropdownGroupLabel>
            <MenuItem index={0} label="Release notes" trailingIcon={External} />
            <MenuItem index={1} label="How to update" />
          </DropdownGroup>
        </DropdownContent>
      </DropdownMenu>
    );

    const group = await view.findByRole("group", {
      name: "Update available: v1.3.0",
    });

    expect(group.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
    expect(
      group.querySelector('[role="menuitem"] [aria-hidden="true"] svg')
    ).not.toBeNull();

    view.unmount();
  });
});
