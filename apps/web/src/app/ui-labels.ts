import type { UiLabels } from "@freenary/ui/lib/labels";

import { m } from "@/paraglide/messages.js";

export const uiLabels = (): UiLabels => ({
  breadcrumb: m.ui_breadcrumb(),
  clear: m.ui_clear(),
  close: m.ui_close(),
  collapseSidebar: m.ui_collapse_sidebar(),
  dismiss: m.ui_dismiss(),
  expandSidebar: m.ui_expand_sidebar(),
  filterResults: m.ui_filter_results(),
  loading: m.ui_loading(),
  loadingPreview: m.ui_loading_preview(),
  more: m.ui_more(),
  open: m.ui_open(),
  peekSidebar: m.ui_peek_sidebar(),
  railClick: m.ui_rail_click(),
  railClickHint: m.ui_rail_click_hint(),
  railDrag: m.ui_rail_drag(),
  railDragHint: m.ui_rail_drag_hint(),
  remove: m.ui_remove(),
  resizeSidebar: m.ui_resize_sidebar(),
  run: m.ui_run(),
  select: m.ui_select(),
  sidebar: m.ui_sidebar(),
  suggestedPrompts: m.ui_suggested_prompts(),
  tabs: m.ui_tabs(),
  thinking: m.ui_thinking(),
  thinkingWords: [
    m.ui_thinking_word_thinking(),
    m.ui_thinking_word_reading(),
    m.ui_thinking_word_planning(),
  ],
  toggleSidebar: m.ui_toggle_sidebar(),
});
