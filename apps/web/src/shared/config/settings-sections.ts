export const SETTINGS_SECTIONS = [
  "appearance",
  "bank-accounts",
  "budget",
  "categories",
  "sign-in",
  "sessions",
  "api-keys",
  "services",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const DEFAULT_SETTINGS_SECTION = "appearance" satisfies SettingsSection;

export const OPERATOR_SETTINGS_SECTIONS: ReadonlySet<SettingsSection> = new Set(
  ["services"]
);

const MERGED_SETTINGS_SECTIONS: ReadonlyMap<string, SettingsSection> = new Map([
  ["connections", "bank-accounts"],
  ["integrations", "services"],
  ["security", "sign-in"],
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
