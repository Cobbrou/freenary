import { MAX_QUESTION_CHARS } from "@freenary/api/assistant/turn";
import { z } from "zod";

const absentUnlessQuestion = z
  .unknown()
  .transform((raw) => {
    const parsed = z
      .string()
      .trim()
      .min(1)
      .max(MAX_QUESTION_CHARS)
      .safeParse(raw);

    return parsed.success ? parsed.data : undefined;
  })
  .optional();

export const newChatSearchSchema = z.object({ draft: absentUnlessQuestion });

export const conversationSearchSchema = z.object({ q: absentUnlessQuestion });
