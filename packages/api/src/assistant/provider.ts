import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { settings } from "@freenary/instance-config";

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
