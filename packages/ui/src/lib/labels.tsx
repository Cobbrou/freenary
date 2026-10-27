import { createContext, use } from "react";
import type { ReactNode } from "react";

/**
 * The accessible names the primitives supply themselves — the ones with no
 * visible text for a caller to pass in. They are English here so the package
 * still stands alone; an app that speaks more than one language overrides them
 * once with `UiLabelsProvider` instead of threading a prop through every call.
 */
export interface UiLabels {
  /** Accessible name of a breadcrumb trail's nav landmark. */
  breadcrumb: string;
  /** Clear control of a combobox field. */
  clear: string;
  /** Dismiss control of a sheet. */
  close: string;
  /** Sidebar trigger's tooltip while the sidebar is open. */
  collapseSidebar: string;
  /** Dismiss control of a card. */
  dismiss: string;
  /** Sidebar trigger's tooltip while the sidebar is collapsed. */
  expandSidebar: string;
  /** Accessible name of a command menu's tab strip. */
  filterResults: string;
  /** Busy state of a spinner. */
  loading: string;
  /** Busy state of a file thumbnail waiting on its preview. */
  loadingPreview: string;
  /** Collapsed overflow of a breadcrumb trail. */
  more: string;
  /** Control that opens a combobox popup. */
  open: string;
  /** Edge strip that floats a collapsed sidebar out without pinning it. */
  peekSidebar: string;
  /** Sidebar rail tooltip, one line per gesture: the verb, set in semibold,
   *  then the rest of the line. */
  railClick: string;
  railClickHint: string;
  railDrag: string;
  railDragHint: string;
  /** Prefix of a chip's remove control, followed by the chip's own label. */
  remove: string;
  /** Grab strip on a sidebar's inner edge. */
  resizeSidebar: string;
  /** Command menu hint for the key that activates the highlighted item. */
  run: string;
  /** Command menu hint for the keys that move the highlight. */
  select: string;
  /** Accessible name of the mobile sidebar dialog. */
  sidebar: string;
  /** Accessible name of a composer's suggested-prompt list. */
  suggestedPrompts: string;
  /** Command menu hint for the keys that switch tabs. */
  tabs: string;
  /** Announcement while an assistant works, and the words it cycles. */
  thinking: string;
  thinkingWords: string[];
  toggleSidebar: string;
}

const DEFAULT_UI_LABELS: UiLabels = {
  breadcrumb: "Breadcrumb",
  clear: "Clear",
  close: "Close",
  collapseSidebar: "Collapse sidebar",
  dismiss: "Dismiss",
  expandSidebar: "Expand sidebar",
  filterResults: "Filter results",
  loading: "Loading",
  loadingPreview: "Loading preview",
  more: "More",
  open: "Open",
  peekSidebar: "Peek sidebar",
  railClick: "Click",
  railClickHint: "to collapse",
  railDrag: "Drag",
  railDragHint: "to resize",
  remove: "Remove",
  resizeSidebar: "Resize or collapse sidebar",
  run: "Run",
  select: "Select",
  sidebar: "Sidebar",
  suggestedPrompts: "Suggested prompts",
  tabs: "Tabs",
  thinking: "Thinking…",
  thinkingWords: ["Thinking", "Planning", "Refining"],
  toggleSidebar: "Toggle Sidebar",
};

const UiLabelsContext = createContext(DEFAULT_UI_LABELS);

export const UiLabelsProvider = ({
  children,
  labels,
}: {
  children: ReactNode;
  labels: UiLabels;
}) => <UiLabelsContext value={labels}>{children}</UiLabelsContext>;

export const useUiLabels = (): UiLabels => use(UiLabelsContext);
