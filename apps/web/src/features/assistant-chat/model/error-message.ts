import { MAX_QUESTION_CHARS } from "@freenary/api/assistant/turn";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

export const assistantErrorMessage = (message: string): string => {
  if (message.includes("rate_limited")) {
    return m.assistant_error_rate_limited();
  }

  if (message.includes("unavailable")) {
    return m.assistant_error_unavailable();
  }

  if (message.includes("unconfigured")) {
    return m.assistant_unavailable_description();
  }

  if (message.includes("question_too_long")) {
    return m.assistant_error_question_too_long({
      max: MAX_QUESTION_CHARS.toLocaleString(getLocale()),
    });
  }

  if (message.includes("browser_model_context")) {
    return m.assistant_error_browser_context();
  }

  if (message.includes("browser_model")) {
    return m.assistant_error_browser_model();
  }

  return m.assistant_error_generic();
};
