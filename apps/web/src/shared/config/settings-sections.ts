export const SETTINGS_SECTIONS = [
  "appearance",
  "connections",
  "budget",
  "security",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const DEFAULT_SETTINGS_SECTION = "appearance" satisfies SettingsSection;

const MERGED_SETTINGS_SECTIONS: ReadonlyMap<string, SettingsSection> = new Map([
  ["integrations", "connections"],
]);

export const isSettingsSection = (
  value: string | undefined
): value is SettingsSection =>
  SETTINGS_SECTIONS.some((section) => section === value);

export const settingsSectionOf = (
  value: string | undefined
): SettingsSection | undefined => {
  if (value === undefined || isSettingsSection(value)) {
    return value;
  }

  return MERGED_SETTINGS_SECTIONS.get(value);
};
