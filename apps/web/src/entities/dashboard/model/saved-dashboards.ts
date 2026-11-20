import { isToolUIPart } from "ai";
import type { UIMessage } from "ai";
import { z } from "zod";

export interface SavedDashboard {
  created: boolean;
  dashboardId: string;
  title: string;
}

const SAVE_DASHBOARD_PART = "tool-save_dashboard";

const savedDashboardSchema = z.object({
  created: z.boolean(),
  dashboardId: z.string(),
  title: z.string(),
});

export const savedDashboardsOf = (
  parts: UIMessage["parts"]
): SavedDashboard[] =>
  parts.flatMap((part) => {
    if (
      !isToolUIPart(part) ||
      part.type !== SAVE_DASHBOARD_PART ||
      part.state !== "output-available"
    ) {
      return [];
    }

    const saved = savedDashboardSchema.safeParse(part.output);

    return saved.success ? [saved.data] : [];
  });
