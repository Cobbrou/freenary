import { z } from "zod";

export const clientEnvSchema = {
  VITE_SERVER_URL: z
    .url()
    .default("http://localhost:3000")
    .describe(
      "The build-time fallback API origin. It applies only while `SERVER_URL` and `PUBLIC_SERVER_URL` are both unset."
    )
    .meta({ example: "https://api.example.com" }),
} as const;
