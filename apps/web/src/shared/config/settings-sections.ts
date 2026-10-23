export const SETTINGS_SECTIONS = [
  "appearance",
  "connections",
  "budget",
  "security",
  "integrations",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const DEFAULT_SETTINGS_SECTION = "appearance" satisfies SettingsSection;

export const isSettingsSection = (
  value: string | undefined
): value is SettingsSection =>
  SETTINGS_SECTIONS.some((section) => section === value);
