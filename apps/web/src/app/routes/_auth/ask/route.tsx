import { createFileRoute } from "@tanstack/react-router";

import { AskArea } from "@/pages/assistant";

export const Route = createFileRoute("/_auth/ask")({
  component: AskArea,
});
