import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import type * as DropdownModule from "@freenary/ui/components/dropdown";
import type * as MenuItemModule from "@freenary/ui/components/menu-item";
import type * as RemixIcons from "@remixicon/react";
import type * as TestingLibrary from "@testing-library/react/pure";
import { JSDOM } from "jsdom";

import type * as RemixIconModule from "@/shared/lib/remix-icon";

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

let testingLibrary: typeof TestingLibrary;
let dropdownModule: typeof DropdownModule;
let menuItemModule: typeof MenuItemModule;
let remixIconsModule: typeof RemixIcons;
let remixIconModule: typeof RemixIconModule;

beforeAll(async () => {
  for (const [name, value] of Object.entries(BROWSER_GLOBALS)) {
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }

  testingLibrary = await import("@testing-library/react/pure");
  dropdownModule = await import("@freenary/ui/components/dropdown");
  menuItemModule = await import("@freenary/ui/components/menu-item");
  remixIconsModule = await import("@remixicon/react");
  remixIconModule = await import("@/shared/lib/remix-icon");
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
    const { render } = testingLibrary;
    const {
      DropdownContent,
      DropdownGroup,
      DropdownGroupLabel,
      DropdownMenu,
      DropdownTrigger,
    } = dropdownModule;

    const { MenuItem } = menuItemModule;
    const { RiExternalLinkLine } = remixIconsModule;
    const { remixIcon } = remixIconModule;
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
