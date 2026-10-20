import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { settings } from "@freenary/instance-config";

export const isAssistantConfigured = (): boolean =>
  settings.AI_BASE_URL !== undefined && settings.AI_MODEL !== undefined;

export const assistantModelId = (): string | null =>
  isAssistantConfigured() ? (settings.AI_MODEL ?? null) : null;

export const assistantModel = () => {
  if (!(settings.AI_BASE_URL && settings.AI_MODEL)) {
    return null;
  }

  const provider = createOpenAICompatible({
    apiKey: settings.AI_API_KEY,
    baseURL: settings.AI_BASE_URL,
    name: "freenary-assistant",
  });

  return provider.chatModel(settings.AI_MODEL);
};
