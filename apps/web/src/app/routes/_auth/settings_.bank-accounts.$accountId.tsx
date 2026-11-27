import { createFileRoute } from "@tanstack/react-router";

import { AccountSettingsPage } from "@/pages/settings";
import { m } from "@/paraglide/messages.js";

import { pageHead } from "../../router/page-head";

export const Route = createFileRoute(
  "/_auth/settings_/bank-accounts/$accountId"
)({
  component: AccountSettingsPage,
  head: pageHead(m.nav_settings),
});
