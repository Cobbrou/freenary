import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SettingsPage } from "@/pages/settings";
import {
  DEFAULT_SETTINGS_SECTION,
  SETTINGS_SECTIONS,
  settingsSectionOf,
} from "@/shared/config";

const settingsSearchSchema = z.object({
  error: z.string().optional(),
  section: z.enum(SETTINGS_SECTIONS).default(DEFAULT_SETTINGS_SECTION),
});

type SettingsSearchInput = z.input<typeof settingsSearchSchema>;

export const Route = createFileRoute("/_auth/settings")({
  component: SettingsPage,
  validateSearch: (search: SettingsSearchInput) =>
    settingsSearchSchema.parse({
      error: search.error,
      section: settingsSectionOf(search.section),
    }),
});
