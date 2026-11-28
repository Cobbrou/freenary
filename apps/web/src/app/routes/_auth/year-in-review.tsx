import { createFileRoute } from "@tanstack/react-router";

import { YearReviewPage, yearReviewSearchSchema } from "@/pages/budget";
import { m } from "@/paraglide/messages.js";

import { pageHead } from "../../router/page-head";

export const Route = createFileRoute("/_auth/year-in-review")({
  component: YearReviewPage,
  head: pageHead(m.nav_year_review),
  validateSearch: yearReviewSearchSchema,
});
