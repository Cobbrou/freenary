import type { EmailMessage, EmailProvider } from "../types";

interface ResendCredentials {
  apiKey: string;
  from: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export const createResendEmailProvider = (
  credentials: ResendCredentials
): EmailProvider => ({
  id: "resend",
  send: async (message: EmailMessage) => {
    const response = await fetch(RESEND_ENDPOINT, {
      body: JSON.stringify({
        from: credentials.from,
        subject: message.subject,
        text: message.text,
        to: [message.to],
      }),
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const body = await response.text();

      throw new Error(
        `Resend rejected the message (${response.status}): ${body}`
      );
    }
  },
});
