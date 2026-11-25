import { settings } from "@freenary/instance-config";

export const isAssistantConfigured = (): boolean =>
  settings.AI_BASE_URL !== undefined && settings.AI_MODEL !== undefined;

export const assistantModelId = (): string | null =>
  isAssistantConfigured() ? (settings.AI_MODEL ?? null) : null;
